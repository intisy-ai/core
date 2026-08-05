// @ts-nocheck
// `core`, the shared foundation for every plugin. Import what you need:
//   import { createLogger, loadConfig, deployCommands, configCommand, maybeRunConfigCli } from "../core/dist/index.js";

export { getApp, isClaude, getAppConfigDir, existingConfigDirs, existingApps, ECOSYSTEM_ORG } from "./env.js";
export { getApps, getApp as getAppDescriptor, registerApp, resolveHome, resolveAppsFile, currentAppId } from "./apps.js";
export type { AppDescriptor } from "./apps.js";
export { ensureDir, atomicWrite, readJson, writeJson } from "./files.js";
export { configPath, loadConfig, defineConfig, getConfigDefaults, getConfigValue, setConfigValue, listConfig, coerce } from "./config.js";
export { defineCapabilities, getCapabilities } from "./capabilities.js";
export type { FieldType, FieldSpec, ActionSpec, CapabilitySchema } from "./capabilities.types.js";
export { publish, publishNotification, subscribe, subscribeHomes, drain, drainHomes, busLogPath, TOPICS } from "./bus.js";
export type { EventEnvelope, NotificationLevel, TopicPayloads, KnownTopic, Cursor, SubscribeOptions } from "./bus.types.js";
export { emitEvent, normalizeActivity, registerActivity, renderActivity, readActivity, setActivityEnabled } from "./activity.js";
export type { Actor, Impact, Subject, ActivitySpec, ActivityRecord, ActivityQuery } from "./activity.types.js";
export { setActivityContext, getActivityContext, resetActivityContext, withCause, currentCause, activityEnv } from "./activity-context.js";
export type { CauseKind, Origin, Target, Cause, Trace, ValueChange } from "./activity.types.js";
export { isSecretKey, redactChanges, describeChange } from "./activity-redact.js";
export { createActivitySeam } from "./activity-seam.js";
export type { ActivitySeam } from "./activity-seam.js";
export { isLoggingEnabled, makeWriteLog, createLogger, globalSetting } from "./log.js";
export { isHookInvocation } from "./hook.js";
export { deployCommands, configCommand } from "./command.js";
export type { CommandDef } from "./command.js";
export { runConfigCli, maybeRunConfigCli } from "./configcli.js";
export { runAllConfigCli, GLOBAL_SETTINGS_DEFAULTS } from "./configcli-all.js";
export type { AllConfigOptions } from "./configcli-all.js";
export { defineReadme, getReadmeSpec, generateReadme, runReadmeCli, maybeRunReadmeCli, registerSection, DEFAULT_SECTIONS } from "./readme.js";
export type { ReadmeSpec, SectionRenderer, ExtraSection } from "./readme.js";
export { BUILTIN_ENGINES, getEngines, engineByCapability, engineById, isEngine, isMandatoryEngine } from "./engines.js";
export type { EngineDescriptor } from "./engines.js";
