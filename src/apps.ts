import { existsSync, statSync } from "fs";
import { isAbsolute, join } from "path";
import { homedir } from "os";
import { atomicWrite, readJson } from "./files.js";

/** The four storage subdirectories every app home carries. */
export interface AppPathNames {
  repos: string;
  plugin: string;
  cache: string;
  config: string;
}

export const DEFAULT_PATH_NAMES: AppPathNames = { repos: "repos", plugin: "plugin", cache: "cache", config: "config" };

// Env overrides exist for the one consumer that cannot read the registry:
// core-loader carries no core submodule (see PLUGIN_MANAGER_PACKAGE in its env.ts),
// so a loader passes the resolved names down instead of re-reading apps.json.
const PATH_ENV: Record<keyof AppPathNames, string> = {
  repos: "HUB_REPOS_SUBDIR",
  plugin: "HUB_PLUGIN_SUBDIR",
  cache: "HUB_CACHE_SUBDIR",
  config: "HUB_CONFIG_SUBDIR",
};

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
  /** Subdirectory names under the app's config dir. Data, not code: an app whose
   * layout differs, or a user who wants its storage elsewhere, changes these
   * rather than any consumer. Resolve them through `appPaths`, never by joining
   * the literal names. */
  paths: AppPathNames;
  proxyPort: number;
  integration: "env-baseurl" | "native";
  wireFormat: string;
  /** Session-storage formats this app writes, for usage readers. Data, not code:
   * a dashboard maps each format id to a parser. Absent means no usage data. */
  usage?: { formats: string[] };
  /** Accent colour for this app's surfaces, as a `#rrggbb` hex string. Presentation data, beside
   *  `icon`. Absent means a consumer uses its own neutral default. */
  accent?: string;
  /** The app's own npm-plugin mechanism. Absent means the app has none, so a consumer offers no
   *  npm rows, no npm section and no npm install method. */
  npmPlugins?: { configFiles: string[]; pluginsKey: string; packageCache?: string };
  /** Where a marketplace looks for this app's community plugins. Absent means a consumer offers
   *  only its own verified built-in list. */
  discovery?: { topic?: string; searchQuery?: string; awesomeList?: string };
  /** Where this app records the projects a user has worked in. Absent means no project history. */
  projects?: { historyFile?: string; sessionDb?: string[] };
  /** The app's own config file a provider merges its model catalog into. Absent means nothing is
   *  merged and the app reads the model cache directly. */
  modelCatalog?: { files: string[]; envOverride?: string; schemaUrl?: string; providerKey: string };
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

/**
 * One declared path, resolved.
 *
 * @remarks
 * A trait declares where something lives without knowing where the app home landed, so a bare
 * name means "inside the home" while `~` still means the user's home directory. Absolute wins
 * over both, which is how an app whose storage sits outside its home declares it.
 */
export function expandPath(value: string, home: string, appHome: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) return "";
  if (trimmedValue === "~" || trimmedValue.startsWith("~/") || trimmedValue.startsWith("~\\")) {
    return expandHome(trimmedValue, home);
  }
  return isAbsolute(trimmedValue) ? trimmedValue : join(appHome, trimmedValue);
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

// A name is taken from the registry entry, then the env override, then the
// default. Only a single path segment is accepted: these name a directory INSIDE
// the app home, so a separator or a traversal would silently relocate storage
// outside it.
function pathName(kind: keyof AppPathNames, declared: unknown, env: NodeJS.ProcessEnv): string {
  for (const candidate of [declared, env[PATH_ENV[kind]]]) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed || trimmed === "." || trimmed === ".." || /[\\/]/.test(trimmed)) continue;
    return trimmed;
  }
  return DEFAULT_PATH_NAMES[kind];
}

function pathNames(declared: unknown, env: NodeJS.ProcessEnv = process.env): AppPathNames {
  const raw = (declared ?? {}) as Partial<Record<keyof AppPathNames, unknown>>;
  return {
    repos: pathName("repos", raw.repos, env),
    plugin: pathName("plugin", raw.plugin, env),
    cache: pathName("cache", raw.cache, env),
    config: pathName("config", raw.config, env),
  };
}

export interface AppPaths {
  repos: string;
  plugin: string;
  cache: string;
  config: string;
}

// The absolute storage directories for one app home. Every consumer resolves
// through this rather than joining "repos"/"plugin"/"cache"/"config" itself, so a
// renamed directory takes effect everywhere at once.
export function appPaths(configDir: string, desc?: AppDescriptor | null, env: NodeJS.ProcessEnv = process.env): AppPaths {
  const names = desc ? desc.paths : pathNames(undefined, env);
  return {
    repos: join(configDir, names.repos),
    plugin: join(configDir, names.plugin),
    cache: join(configDir, names.cache),
    config: join(configDir, names.config),
  };
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
      paths: pathNames(w.paths, env),
      proxyPort: w.proxyPort ?? 0,
      integration: w.integration ?? "env-baseurl",
      wireFormat: w.wireFormat ?? "anthropic",
      usage: w.usage,
      accent: w.accent,
      npmPlugins: w.npmPlugins,
      discovery: w.discovery,
      projects: w.projects,
      modelCatalog: w.modelCatalog,
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

// Which app owns a given home directory, by matching it against the registry. A
// component that states the home it is acting on (a dashboard driving an updater for
// another app's home) gets the right app id without any app being named in code.
export function appIdForHome(dir: string, env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const target = trimmed(dir);
  if (!target) return "";
  const hit = getApps(env, home).find((a) => forcedDirMatchesApp(target, a, home));
  return hit ? hit.id : "";
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

// Changes only an existing app's storage names, leaving the rest of its descriptor alone.
// Moving what is already on disk is the caller's job (core-app-paths' moveAppPaths): doing
// it here would make a failed move indistinguishable from a registry that never changed.
export function setAppPaths(id: string, names: AppPathNames, env: NodeJS.ProcessEnv = process.env, home: string = homedir()): void {
  const raw = readRaw(env, home);
  const entry = raw[id];
  if (!entry) throw new Error(`unknown app: ${id}`);
  raw[id] = { ...entry, paths: pathNames(names, env) };
  atomicWrite(resolveAppsFile(env, home), JSON.stringify(raw, null, 2));
  CACHE = null;
  CACHE_KEY = "";
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
