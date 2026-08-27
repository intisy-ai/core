// Per-plugin config: the standard two-path file (config/<name>.json preferred,
// <name>.json fallback) plus generic get/set/list over it. The get/set/list are
// what powers "100% configurable via commands"; every key is reachable by name.

import { join } from "path";
import { existsSync } from "fs";
import { getAppConfigDir } from "./env.js";
import { readJson, writeJson } from "./files.js";

const CACHE: Record<string, Record<string, unknown>> = {};

/** One configuration value that changed, as the change hook is told about it. */
export interface ConfigChange {
  key: string;
  from?: unknown;
  to?: unknown;
}

type ConfigChangeHook = (name: string, key: string, change: ConfigChange, configDir: string) => void;

let CONFIG_CHANGE_HOOK: ConfigChangeHook | null = null;

// installed by activity.ts on import, so a config write also lands on the activity
// bus without config.ts importing activity.ts (which would cycle back through
// activity.ts -> log.ts -> config.ts).
/**
 * Installs the hook a configuration write is reported to.
 *
 * @param fn what to call on each write.
 */
export function setConfigChangeHook(fn: ConfigChangeHook): void {
  CONFIG_CHANGE_HOOK = typeof fn === "function" ? fn : null;
}

// preferred config/<name>.json; fall back to top-level <name>.json if that's what
// exists; config/ is the canonical WRITE site.
/**
 * Where one plugin keeps its configuration.
 *
 * @param name the plugin.
 * @param configDir the home to resolve against.
 * @returns the preferred path, which is the one a write always uses.
 */
export function configPath(name: string, configDir = getAppConfigDir()): string {
  const preferred = join(configDir, "config", `${name}.json`);
  const fallback = join(configDir, `${name}.json`);
  if (existsSync(preferred)) return preferred;
  if (existsSync(fallback)) return fallback;
  return preferred;
}

/**
 * Reads one plugin configuration, preferring the config subdirectory over the home root.
 *
 * @param name the plugin.
 * @param configDir the home to read from.
 * @returns the stored values, empty when there is no file.
 */
export function loadConfig(name: string, configDir = getAppConfigDir()): Record<string, unknown> {
  const key = configDir + "::" + name;
  if (CACHE[key]) return CACHE[key];
  const data = readJson(configPath(name, configDir), {}) as Record<string, unknown>;
  CACHE[key] = (data && typeof data === "object" && !Array.isArray(data)) ? data : {};
  return CACHE[key];
}

// ---- Config schema registry ------------------------------------------------
// Plugins DECLARE their settings + defaults via defineConfig() at load time (before
// the `config` CLI guard). This registers the schema so the loader's Configure screen
// can discover + edit every setting (`config schema`), but it DELIBERATELY WRITES
// NOTHING. Launching the app must never create a config file. A file appears only when
// a value is actually changed (setConfigValue), i.e. from the loader or `<plugin>-config set`.
const DEFAULTS: Record<string, Record<string, unknown>> = {};

// Register a plugin's config defaults (merged if called more than once) and return the
// effective config (declared defaults + on-disk overrides). No file is written.
/**
 * Registers a plugin settings and their defaults.
 *
 * @param name the plugin.
 * @param defaults the settings and the value each takes when unset.
 * @param configDir the home to read any stored values from.
 * @returns the defaults with anything stored on disk applied over them.
 * @remarks
 * Writes nothing. Launching an app must never create a configuration file, so a file appears only
 * once a value is actually changed.
 */
export function defineConfig(name: string, defaults: Record<string, unknown>, configDir = getAppConfigDir()): Record<string, unknown> {
  DEFAULTS[name] = { ...(DEFAULTS[name] ?? {}), ...defaults };
  return { ...DEFAULTS[name], ...loadConfig(name, configDir) };
}

// The defaults a plugin declared via defineConfig (empty object if it never did).
/**
 * The defaults one plugin registered.
 *
 * @param name the plugin.
 * @returns the defaults, empty when the plugin registered none.
 */
export function getConfigDefaults(name: string): Record<string, unknown> {
  return { ...(DEFAULTS[name] ?? {}) };
}

// dot-path get, e.g. getConfigValue("antigravity", "selection.strategy")
/**
 * One configuration value, falling back to the registered default.
 *
 * @param name the plugin.
 * @param key the setting.
 * @param configDir the home to read from.
 * @returns the stored value, the default, or undefined when neither exists.
 */
export function getConfigValue(name: string, key: string, configDir = getAppConfigDir()): unknown {
  let node: unknown = loadConfig(name, configDir);
  for (const part of key.split(".")) {
    if (node && typeof node === "object") node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return node;
}

// parse a CLI string into the obvious type (true/false/number/json, else string)
/**
 * Reads a command-line string as the value it denotes.
 *
 * @param value the text as typed.
 * @returns a boolean, a number, parsed JSON or the string itself, in that order of preference.
 */
export function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value !== "" && !isNaN(Number(value))) return Number(value);
  if (/^[[{]/.test(value.trim())) { try { return JSON.parse(value); } catch { /* keep string */ } }
  return value;
}

// dot-path set; writes to config/<name>.json and refreshes the cache
/**
 * Writes one configuration value, creating the file if this is the first change.
 *
 * @param name the plugin.
 * @param key the setting.
 * @param value what to store.
 * @param configDir the home to write to.
 */
export function setConfigValue(name: string, key: string, value: unknown, configDir = getAppConfigDir()): void {
  const previous = getConfigValue(name, key, configDir);
  const root = { ...loadConfig(name, configDir) };
  const parts = key.split(".");
  let node: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = node[parts[i]];
    node[parts[i]] = (next && typeof next === "object" && !Array.isArray(next)) ? { ...(next as object) } : {};
    node = node[parts[i]] as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
  const target = join(configDir, "config", `${name}.json`);
  writeJson(target, root);
  CACHE[configDir + "::" + name] = root;
  if (CONFIG_CHANGE_HOOK) { try { CONFIG_CHANGE_HOOK(name, key, { key, from: previous, to: value }, configDir); } catch {} }
}

/**
 * Every setting of one plugin, defaults included.
 *
 * @param name the plugin.
 * @param configDir the home to read from.
 * @returns the registered defaults with anything stored applied over them.
 */
export function listConfig(name: string, configDir = getAppConfigDir()): Record<string, unknown> {
  return loadConfig(name, configDir);
}
