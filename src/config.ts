// @ts-nocheck
// Per-plugin config: the standard two-path file (config/<name>.json preferred,
// <name>.json fallback) plus generic get/set/list over it. The get/set/list are
// what powers "100% configurable via commands" — every key is reachable by name.

import { join } from "path";
import { existsSync } from "fs";
import { getAppConfigDir } from "./env.js";
import { readJson, writeJson } from "./files.js";

const CACHE: Record<string, Record<string, unknown>> = {};

// preferred config/<name>.json; fall back to top-level <name>.json if that's what
// exists; config/ is the canonical WRITE site.
export function configPath(name: string, configDir = getAppConfigDir()): string {
  const preferred = join(configDir, "config", `${name}.json`);
  const fallback = join(configDir, `${name}.json`);
  if (existsSync(preferred)) return preferred;
  if (existsSync(fallback)) return fallback;
  return preferred;
}

export function loadConfig(name: string, configDir = getAppConfigDir()): Record<string, unknown> {
  const key = configDir + "::" + name;
  if (CACHE[key]) return CACHE[key];
  const data = readJson(configPath(name, configDir), {}) as Record<string, unknown>;
  CACHE[key] = (data && typeof data === "object" && !Array.isArray(data)) ? data : {};
  return CACHE[key];
}

// Materialize config/<name>.json with `defaults` if no config file exists yet, so a
// plugin's *meaningful* settings show up on disk (discoverable + editable). NOT every
// plugin needs a config file: a "trivial" default (nothing, or only `logging`, which
// already defaults on) is never written — it would just be noise. Idempotent; never
// clobbers an existing file. Returns the effective config (defaults + on-disk overrides).
export function ensureConfig(name: string, defaults: Record<string, unknown>, configDir = getAppConfigDir()): Record<string, unknown> {
  const trivial = Object.keys(defaults).every((k) => k === "logging");
  const preferred = join(configDir, "config", `${name}.json`);
  const fallback = join(configDir, `${name}.json`);
  if (!trivial && !existsSync(preferred) && !existsSync(fallback)) {
    try { writeJson(preferred, defaults); } catch { /* best-effort */ }
    CACHE[configDir + "::" + name] = { ...defaults };
    return CACHE[configDir + "::" + name];
  }
  return { ...defaults, ...loadConfig(name, configDir) };
}

// dot-path get, e.g. getConfigValue("antigravity", "selection.strategy")
export function getConfigValue(name: string, key: string, configDir = getAppConfigDir()): unknown {
  let node: unknown = loadConfig(name, configDir);
  for (const part of key.split(".")) {
    if (node && typeof node === "object") node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return node;
}

// parse a CLI string into the obvious type (true/false/number/json, else string)
export function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value !== "" && !isNaN(Number(value))) return Number(value);
  if (/^[[{]/.test(value.trim())) { try { return JSON.parse(value); } catch { /* keep string */ } }
  return value;
}

// dot-path set; writes to config/<name>.json and refreshes the cache
export function setConfigValue(name: string, key: string, value: unknown, configDir = getAppConfigDir()): void {
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
}

export function listConfig(name: string, configDir = getAppConfigDir()): Record<string, unknown> {
  return loadConfig(name, configDir);
}
