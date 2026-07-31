import { existsSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { atomicWrite, readJson } from "./files.js";

export interface AppDescriptor {
  id: string;
  label: string;
  /** Self-contained SVG mark for the app, rendered by dashboards. Data, not code. */
  icon?: string;
  home: {
    envOverride?: string;
    nativeEnv?: string;
    xdgSubdir?: string;
    candidates: string[];
  };
  detect: { binary: string; pkg: string };
  /** The loader plugin that connects this app to the local API. Data, not code:
   * a dashboard reads this to install and track the app's loader. Absent means
   * the app has no loader. */
  loader?: { id: string; url: string };
  commandsSubdir: string;
  proxyPort: number;
  integration: "env-baseurl" | "native";
  wireFormat: string;
  /** Session-storage formats this app writes, for usage readers. Data, not code:
   * a dashboard maps each format id to a parser. Absent means no usage data. */
  usage?: { formats: string[] };
}

let CACHE: AppDescriptor[] | null = null;
let CACHE_KEY = "";

function trimmed(v?: string): string {
  return v && v.trim() ? v.trim() : "";
}

function expandHome(p: string, home: string): string {
  if (p === "~") return home;
  if (p.startsWith("~/") || p.startsWith("~\\")) return join(home, p.slice(2));
  return p;
}

export function resolveAppsFile(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const override = trimmed(env.HUB_APPS_FILE);
  if (override) return override;
  return join(home, ".config", "cairn", "apps.json");
}

function isValid(desc: Partial<AppDescriptor>): desc is AppDescriptor {
  return typeof desc.id === "string" && desc.id.length > 0
    && typeof desc.label === "string"
    && !!desc.home && Array.isArray(desc.home.candidates) && desc.home.candidates.length > 0;
}

function readRaw(env: NodeJS.ProcessEnv, home: string): Record<string, Partial<AppDescriptor>> {
  const file = resolveAppsFile(env, home);
  if (!existsSync(file)) return {};
  const data = readJson(file, null) as Record<string, Partial<AppDescriptor>> | null;
  return data && typeof data === "object" && !Array.isArray(data) ? data : {};
}

function build(env: NodeJS.ProcessEnv, home: string): AppDescriptor[] {
  const raw = readRaw(env, home);
  const out: AppDescriptor[] = [];
  for (const [id, entry] of Object.entries(raw)) {
    const w = { ...entry, id: entry.id ?? id };
    if (!isValid(w)) continue;
    out.push({
      id: w.id,
      label: w.label,
      icon: w.icon,
      home: w.home,
      detect: { binary: w.detect?.binary ?? w.id, pkg: w.detect?.pkg ?? "" },
      loader: w.loader,
      commandsSubdir: w.commandsSubdir ?? "commands",
      proxyPort: w.proxyPort ?? 0,
      integration: w.integration ?? "env-baseurl",
      wireFormat: w.wireFormat ?? "anthropic",
      usage: w.usage,
    });
  }
  return out;
}

export function getApps(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): AppDescriptor[] {
  const file = resolveAppsFile(env, home);
  let mtime = 0;
  try { mtime = existsSync(file) ? statSync(file).mtimeMs : 0; } catch { mtime = 0; }
  const key = file + "::" + mtime;
  if (CACHE && CACHE_KEY === key) return CACHE;
  CACHE = build(env, home);
  CACHE_KEY = key;
  return CACHE;
}

export function getApp(id: string, env: NodeJS.ProcessEnv = process.env, home: string = homedir()): AppDescriptor | undefined {
  return getApps(env, home).find((a) => a.id === id);
}

export function resolveHome(desc: AppDescriptor, env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const over = desc.home.envOverride ? trimmed(env[desc.home.envOverride]) : "";
  if (over) return over;
  const native = desc.home.nativeEnv ? trimmed(env[desc.home.nativeEnv]) : "";
  if (native) return native;
  if (desc.home.xdgSubdir) {
    const xdg = trimmed(env.XDG_CONFIG_HOME);
    if (xdg) return join(xdg, desc.home.xdgSubdir);
  }
  const cands = desc.home.candidates.map((c) => expandHome(c, home));
  for (const c of cands) if (existsSync(c)) return c;
  return cands[cands.length - 1] ?? "";
}

// splits into alphanumeric tokens so a binary name is matched as a whole word
// even inside a longer path segment (e.g. "claude" inside ".../claude-code/cli.js")
function hasArgvToken(argv: string, binary: string): boolean {
  if (!binary) return false;
  return argv.toLowerCase().split(/[^a-z0-9]+/).includes(binary.toLowerCase());
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

function pathPrefixMatch(forced: string, candidate: string): boolean {
  const f = normalizePath(forced);
  const c = normalizePath(candidate);
  if (!f || !c) return false;
  return f === c || f.startsWith(c + "/") || c.startsWith(f + "/");
}

// forced dirs don't always land exactly on a registered candidate (e.g. a custom
// XDG_CONFIG_HOME), so also accept a path whose xdg subdir or trailing segment
// (the conventional home folder name) names the app
function forcedDirMatchesApp(forced: string, desc: AppDescriptor, home: string): boolean {
  const cands = desc.home.candidates.map((c) => expandHome(c, home));
  if (cands.some((c) => pathPrefixMatch(forced, c))) return true;
  const normForced = normalizePath(forced);
  if (desc.home.xdgSubdir && normForced.endsWith("/" + desc.home.xdgSubdir.toLowerCase())) return true;
  if (desc.home.nativeEnv) {
    const base = normForced.split("/").pop() ?? "";
    if (base === desc.id.toLowerCase()) return true;
  }
  return false;
}

export function currentAppId(env: NodeJS.ProcessEnv = process.env): string {
  const override = trimmed(env.CORE_APP);
  if (override) return override;

  const home = homedir();
  const apps = getApps(env, home);
  const argv = process.argv.join(" ");

  const argvHits = apps.filter((a) => hasArgvToken(argv, a.detect.binary));
  if (argvHits.length > 0) return argvHits[0].id;

  const envHits = apps.filter((a) => a.home.nativeEnv && trimmed(env[a.home.nativeEnv]));
  if (envHits.length > 0) return envHits[0].id;

  const forced = trimmed(env.HUB_CONFIG_DIR);
  if (forced) {
    const forcedHit = apps.find((a) => forcedDirMatchesApp(forced, a, home));
    if (forcedHit) return forcedHit.id;
  }

  return "";
}

export function registerApp(desc: AppDescriptor, env: NodeJS.ProcessEnv = process.env, home: string = homedir()): void {
  const id = desc.id;
  if (!isValid(desc)) throw new Error(`invalid app descriptor: ${id}`);
  const raw = readRaw(env, home);
  raw[desc.id] = desc;
  atomicWrite(resolveAppsFile(env, home), JSON.stringify(raw, null, 2));
  CACHE = null;
  CACHE_KEY = "";
}
