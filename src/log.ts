// Logging. File output is per-plugin (`logging: false` in the plugin's own config
// disables it). Console output is GLOBAL, off by default, toggled for every plugin
// at once via config/settings.json `logConsole` or the CORE_LOG_CONSOLE env var. Console
// lines go to stderr (visible in the terminal, and safe for the Claude hook protocol
// + opencode's parsed stdout), are prefixed with `[name]`, and are colored per-plugin.

import { join } from "path";
import { appendFileSync } from "fs";
import { getAppConfigDir } from "./env.js";
import { loadConfig } from "./config.js";
import { ensureDir } from "./files.js";

/** Everything one plugin needs to read its own settings and write its own log. */
export interface PluginLogger {
  /** This plugin stored configuration. */
  getConfig: () => Record<string, unknown>;
  /** Whether this plugin writes a log file. */
  isLoggingEnabled: () => boolean;
  /** Writes one log line, and never throws. */
  writeLog: ReturnType<typeof makeWriteLog>;
}

/** Called when an error-level log line is written, so it also reaches the activity record. */
type ErrorActivityHook = (name: string, message: string) => void;

let ERROR_ACTIVITY_HOOK: ErrorActivityHook | null = null;

// installed by activity.ts on import, so an error-level log write also lands on
// the activity bus without log.ts importing activity.ts (which would cycle back
// through activity.ts -> log.ts -> config.ts).
/**
 * Installs the hook an error-level log write is reported to.
 *
 * @param fn what to call, or null to remove the hook.
 * @remarks
 * Installed by the activity module on import, so an error also reaches the activity record without
 * this module importing that one and cycling back through the configuration loader.
 */
export function setErrorActivityHook(fn: ErrorActivityHook | null | undefined): void {
  ERROR_ACTIVITY_HOOK = typeof fn === "function" ? fn : null;
}

const START_TIME = new Date().toISOString().replace(/:/g, "-").split(".")[0];

// ---- global ecosystem config (config/settings.json, the opencode.json-equivalent
// for our plugins; the Claude home has its own). Read with the reserved name "settings". ----
/**
 * One ecosystem-wide setting, shared by every plugin in a home.
 *
 * @param key the setting.
 * @param fallback what to answer when it is unset.
 * @param configDir the home to read from.
 * @returns the stored value, or the fallback.
 */
export function globalSetting(key: string, fallback?: unknown, configDir = getAppConfigDir()): unknown {
  const v = loadConfig("settings", configDir)[key];
  return v === undefined ? fallback : v;
}

/**
 * Whether an environment variable reads as on.
 *
 * @param v the raw value, which may be absent.
 * @returns true for the values a person would mean by yes.
 */
export function envTruthy(v?: string): boolean {
  return !!v && v !== "0" && v.toLowerCase() !== "false";
}

// console mirroring is GLOBAL: env wins, else config/settings.json `logConsole`
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

/**
 * Whether one plugin writes a log file.
 *
 * @param name the plugin.
 * @param configDir the home to read the setting from.
 * @returns true unless the plugin has switched logging off.
 */
export function isLoggingEnabled(name: string, configDir = getAppConfigDir()): boolean {
  return loadConfig(name, configDir).logging !== false;
}

// returns writeLog(message, isError?) bound to this plugin name. Never throws.
/**
 * The log-writing function one plugin uses.
 *
 * @param name the plugin, which names both the file and the console prefix.
 * @param configDir the home to write into.
 * @returns a function that writes one line and never throws.
 */
export function makeWriteLog(name: string, configDir = getAppConfigDir()) {
  return function writeLog(message: string, isError = false): void {
    try {
      if (isError && ERROR_ACTIVITY_HOOK) { try { ERROR_ACTIVITY_HOOK(name, message); } catch {} }
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

/**
 * A logger with one method per level for one plugin.
 *
 * @param name the plugin.
 * @param configDir the home to write into.
 * @returns the logger.
 */
export function createLogger(name: string, configDir = getAppConfigDir()): PluginLogger {
  return {
    getConfig: () => loadConfig(name, configDir),
    isLoggingEnabled: () => isLoggingEnabled(name, configDir),
    writeLog: makeWriteLog(name, configDir),
  };
}
