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
  commandsSubdir: string;
  proxyPort: number;
  integration: "env-baseurl" | "native";
  wireFormat: string;
  builtin: boolean;
}

export const BUILTIN_APPS: AppDescriptor[] = [
  {
    id: "claude",
    label: "Claude Code",
    home: {
      envOverride: "HUB_CLAUDE_DIR",
      nativeEnv: "CLAUDE_CONFIG_DIR",
      candidates: ["~/.claude", "~/.config/claude"],
    },
    detect: { binary: "claude", pkg: "@anthropic-ai/claude-code" },
    commandsSubdir: "commands",
    proxyPort: 34567,
    integration: "env-baseurl",
    wireFormat: "anthropic",
    builtin: true,
  },
  {
    id: "opencode",
    label: "OpenCode",
    home: {
      envOverride: "HUB_OPENCODE_DIR",
      nativeEnv: "OPENCODE_CONFIG_DIR",
      xdgSubdir: "opencode",
      candidates: ["~/.config/opencode", "~/.opencode"],
    },
    detect: { binary: "opencode", pkg: "opencode-ai" },
    commandsSubdir: "command",
    proxyPort: 34568,
    integration: "native",
    wireFormat: "anthropic",
    builtin: true,
  },
];

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

function mergeDescriptor(base: AppDescriptor, over: Partial<AppDescriptor>): AppDescriptor {
  return {
    ...base,
    ...over,
    home: { ...base.home, ...(over.home ?? {}) },
    detect: { ...base.detect, ...(over.detect ?? {}) },
  };
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
  const byId = new Map<string, AppDescriptor>();
  for (const b of BUILTIN_APPS) byId.set(b.id, b);
  for (const [id, entry] of Object.entries(raw)) {
    const withId = { ...entry, id: entry.id ?? id };
    const existing = byId.get(id);
    if (existing) {
      byId.set(id, mergeDescriptor(existing, withId));
    } else if (isValid(withId)) {
      const w = withId;
      byId.set(id, {
        id: w.id,
        label: w.label,
        icon: w.icon,
        home: w.home,
        detect: { binary: w.detect?.binary ?? id, pkg: w.detect?.pkg ?? "" },
        commandsSubdir: w.commandsSubdir ?? "commands",
        proxyPort: w.proxyPort ?? 0,
        integration: w.integration ?? "env-baseurl",
        wireFormat: w.wireFormat ?? "anthropic",
        builtin: w.builtin ?? false,
      });
    }
  }
  return [...byId.values()];
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

export function currentAppId(env: NodeJS.ProcessEnv = process.env): string {
  const override = trimmed(env.CORE_APP);
  if (override) return override;
  const forced = trimmed(env.HUB_CONFIG_DIR);
  if (forced) return /(^|[\\/])\.?claude([\\/]|$)/i.test(forced) ? "claude" : "opencode";
  return process.argv.join(" ").includes("claude") ? "claude" : "opencode";
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
