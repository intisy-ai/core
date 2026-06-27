// @ts-nocheck
// Logging. File output is per-plugin (`logging: false` in the plugin's own config
// disables it). Console output is GLOBAL — off by default, toggled for every plugin
// at once via config/core.json `logConsole` or the CORE_LOG_CONSOLE env var. Console
// lines go to stderr (visible in the terminal, and safe for the Claude hook protocol
// + opencode's parsed stdout), are prefixed with `[name]`, and are colored per-plugin.

import { join } from "path";
import { appendFileSync } from "fs";
import { getAppConfigDir } from "./env.js";
import { loadConfig } from "./config.js";
import { ensureDir } from "./files.js";

const START_TIME = new Date().toISOString().replace(/:/g, "-").split(".")[0];

// ---- global ecosystem config (config/settings.json — the opencode.json-equivalent
// for our plugins; the Claude home has its own). Read with the reserved name "settings". ----
export function globalSetting(key: string, fallback?: unknown, configDir = getAppConfigDir()): unknown {
  const v = loadConfig("settings", configDir)[key];
  return v === undefined ? fallback : v;
}

function envTruthy(v?: string): boolean {
  return !!v && v !== "0" && v.toLowerCase() !== "false";
}

// console mirroring is GLOBAL: env wins, else config/core.json `logConsole`
function consoleEnabled(configDir: string): boolean {
  if (process.env.CORE_LOG_CONSOLE !== undefined) return envTruthy(process.env.CORE_LOG_CONSOLE);
  return globalSetting("logConsole", false, configDir) === true;
}
function colorEnabled(configDir: string): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  return globalSetting("logColor", true, configDir) !== false;
}

// ---- color: a stable per-plugin color so interleaved logs are easy to tell apart ----
const RESET = "\x1b[0m";
const RED = 31;
const PALETTE = [36, 32, 33, 35, 34, 96, 92, 93, 95, 94]; // cyan green yellow magenta blue + bright
function prefixColor(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function paint(code: number, s: string): string {
  return `\x1b[${code}m${s}${RESET}`;
}

export function isLoggingEnabled(name: string, configDir = getAppConfigDir()): boolean {
  return loadConfig(name, configDir).logging !== false;
}

// returns writeLog(message, isError?) bound to this plugin name. Never throws.
export function makeWriteLog(name: string, configDir = getAppConfigDir()) {
  return function writeLog(message: string, isError = false): void {
    try {
      // console (stderr): errors always; informational lines only when console
      // logging is globally enabled. Prefixed [name] + colored per-plugin.
      if (isError || consoleEnabled(configDir)) {
        if (colorEnabled(configDir)) {
          const tag = paint(prefixColor(name), `[${name}]`);
          console.error(`${tag} ${isError ? paint(RED, message) : message}`);
        } else {
          console.error(`[${name}] ${message}`);
        }
      }
      // file: per-plugin logging flag (default on)
      if (!isLoggingEnabled(name, configDir)) return;
      const date = new Date();
      const dir = join(configDir, "logs", date.toISOString().split("T")[0]);
      ensureDir(dir);
      const prefix = isError ? "[ERROR]" : "[INFO]";
      appendFileSync(join(dir, `${name}-${START_TIME}.log`), `[${date.toISOString()}] ${prefix} ${message}\n`);
    } catch { /* never crash on log failure */ }
  };
}

export function createLogger(name: string, configDir = getAppConfigDir()) {
  return {
    getConfig: () => loadConfig(name, configDir),
    isLoggingEnabled: () => isLoggingEnabled(name, configDir),
    writeLog: makeWriteLog(name, configDir),
  };
}
