import type { EventBus, EventPayload, EventTopic, Logger, PluginConfig, PluginPaths } from "@intisy-ai/api";
import { appIdForHome, appPaths, getApp } from "./apps.js";
import { publish, subscribeHomes } from "./bus.js";
import { getConfigDefaults, getConfigValue, loadConfig, setConfigValue } from "./config.js";
import { makeWriteLog } from "./log.js";

/** The per-plugin half of a plugin context, which is everything a context carries that is not the host's own. */
export interface PluginRuntimeParts {
  /** The plugin's resolved configuration. */
  config: PluginConfig;
  /** The plugin's logger. */
  log: Logger;
  /** The storage directories of the home the plugin runs in. */
  paths: PluginPaths;
  /** The event bus, scoped to this plugin as its source. */
  events: EventBus;
}

function dotGet<T>(node: unknown, key: string): T | undefined {
  let current: unknown = node;
  for (const part of key.split(".")) {
    if (current && typeof current === "object") current = (current as Record<string, unknown>)[part];
    else return undefined;
  }
  return current as T | undefined;
}

/**
 * Resolves one plugin's configuration.
 *
 * @remarks
 * `loadConfig` and `getConfigValue` read only what a plugin actually wrote to disk, because
 * `defineConfig` deliberately writes nothing and keeps declared defaults in a separate in-memory
 * registry. `PluginConfig` promises defaults merged with what is on disk, so this merges both
 * sides itself, on-disk winning, exactly as `defineConfig`'s own return value does.
 */
function configFor(name: string, configDir: string): PluginConfig {
  return {
    all: () => ({ ...getConfigDefaults(name), ...loadConfig(name, configDir) }),
    get: <T = unknown>(key: string): T | undefined => {
      const onDisk = getConfigValue(name, key, configDir) as T | undefined;
      return onDisk !== undefined ? onDisk : dotGet<T>(getConfigDefaults(name), key);
    },
    set: async (key: string, value: unknown): Promise<void> => {
      setConfigValue(name, key, value, configDir);
    },
  };
}

function loggerFor(name: string, configDir: string): Logger {
  const writeLog = makeWriteLog(name, configDir);
  return {
    info: (message) => writeLog(message),
    warn: (message) => writeLog(`WARN ${message}`),
    error: (message, cause) => writeLog(cause === undefined ? message : `${message}: ${String(cause)}`, true),
    debug: (message) => writeLog(`DEBUG ${message}`),
  };
}

/**
 * Resolves a home's storage directories.
 *
 * @remarks
 * The home's own registry entry is consulted first, so a home that renamed a storage directory in
 * its `apps.json` is answered with the names it chose. A home the registry does not know keeps the
 * environment-override defaults `appPaths` applies on its own.
 */
function pathsFor(configDir: string): PluginPaths {
  const appId = appIdForHome(configDir);
  const descriptor = appId ? getApp(appId) : undefined;
  return { home: configDir, ...appPaths(configDir, descriptor) };
}

/**
 * Builds the event bus one plugin publishes and subscribes through.
 *
 * @remarks
 * `subscribeHomes` rather than the bare `subscribe`, which always watches the ambient process home
 * with no way to point it elsewhere; its handler receives the full bus envelope, so this unwraps
 * `.payload` to match `EventBus`'s listener contract.
 */
function eventsFor(name: string, configDir: string): EventBus {
  return {
    publish: (<T extends EventTopic>(topic: T, payload: EventPayload<T>) => {
      publish(topic as string, payload, name, configDir);
    }) as EventBus["publish"],
    subscribe: ((topic: string, listener: (payload: unknown) => void) =>
      subscribeHomes([configDir], topic, (envelope: { payload: unknown }) => listener(envelope.payload))) as EventBus["subscribe"],
  };
}

/**
 * Builds the per-plugin half of a plugin context from this library's own config, logging, path and
 * bus machinery.
 *
 * @remarks
 * A host passes the result straight to the api package's `contextFor`, which is what lets a plugin
 * reach all of it through `ctx` and import none of it. The `paths` come from the home rather than
 * from a plugin's own guesswork, so a renamed storage directory takes effect everywhere at once.
 *
 * @param name - the plugin's config name, which is also how its log lines are attributed
 * @param configDir - the app home to resolve against
 */
export function createPluginRuntime(name: string, configDir: string): PluginRuntimeParts {
  return {
    config: configFor(name, configDir),
    log: loggerFor(name, configDir),
    paths: pathsFor(configDir),
    events: eventsFor(name, configDir),
  };
}
