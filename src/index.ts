// @ts-nocheck
// `core` — the shared foundation for every plugin. Import what you need:
//   import { createLogger, loadConfig, deployCommands, configCommand, maybeRunConfigCli } from "../core/dist/index.js";

export { getApp, isClaude, getAppConfigDir, existingConfigDirs, existingApps } from "./env.js";
export { ensureDir, atomicWrite, readJson, writeJson } from "./files.js";
export { configPath, loadConfig, getConfigValue, setConfigValue, listConfig, coerce } from "./config.js";
export { isLoggingEnabled, makeWriteLog, createLogger, globalSetting } from "./log.js";
export { isHookInvocation } from "./hook.js";
export { deployCommands, configCommand } from "./command.js";
export type { CommandDef } from "./command.js";
export { runConfigCli, maybeRunConfigCli } from "./configcli.js";
