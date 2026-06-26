// @ts-nocheck
// Logging, toggleable via the plugin's own config (`logging: false` disables it).
// Writes to <configDir>/logs/YYYY-MM-DD/<name>-HH-MM-SS.log. Absorbs core-log's
// API (makeWriteLog / isLoggingEnabled / createLogger) so plugins migrate 1:1.

import { join } from "path";
import { appendFileSync } from "fs";
import { getAppConfigDir } from "./env.js";
import { loadConfig } from "./config.js";
import { ensureDir } from "./files.js";

const START_TIME = new Date().toISOString().replace(/:/g, "-").split(".")[0];

export function isLoggingEnabled(name: string, configDir = getAppConfigDir()): boolean {
  return loadConfig(name, configDir).logging !== false;
}

// returns writeLog(message, isError?) bound to this plugin name. Never throws.
// When logging is off, file writes are suppressed (console.error still fires).
export function makeWriteLog(name: string, configDir = getAppConfigDir()) {
  return function writeLog(message: string, isError = false): void {
    try {
      if (isError) console.error(message);
      else if (isLoggingEnabled(name, configDir)) console.log(message);
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
