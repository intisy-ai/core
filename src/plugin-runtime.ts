import { existsSync } from "node:fs";
import type { EventBusShape, HomeDescriptorShape, HomeRegistryShape } from "@intisy-ai/api/engine";
import type { Logger, PluginConfig, PluginPaths } from "@intisy-ai/api";
import { appIdForHome, appPaths, getApp, getApps, resolveHome } from "./apps.js";
import { publish, subscribeHomes } from "./bus.js";
import { redactDetails } from "./activity.js";
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
  events: EventBusShape;
  /** Every app home the registry knows. */
  homes: HomeRegistryShape;
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
    error: (message: string, cause?: unknown) => writeLog(cause === undefined ? message : `${message}: ${String(cause)}`, true),
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
 * Resolves every home the registry knows, each with its own storage directories.
 *
 * @remarks
 * Deduped by resolved path, because two registry entries can name the same directory and a plugin
 * acting on each would act on it twice. Resolved on every call rather than once per activation, so a
 * home that is created, or an app that is installed, while a plugin runs is seen.
 */
function homesFor(): HomeRegistryShape {
  return {
    all: () => {
      const seen = new Set<string>();
      const homes: HomeDescriptorShape[] = [];
      for (const descriptor of getApps()) {
        const home = resolveHome(descriptor);
        if (!home || seen.has(home)) continue;
        seen.add(home);
        const entry: HomeDescriptorShape = {
          app: descriptor.id,
          label: descriptor.label,
          present: existsSync(home),
          paths: { home, ...appPaths(home, descriptor) },
        };
        if (descriptor.loader) entry.loader = descriptor.loader.id;
        homes.push(entry);
      }
      return homes;
    },
  };
}

function redactPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const record = payload as Record<string, unknown>;
  if (!record.details) return payload;
  return { ...record, details: redactDetails(record.details) };
}

/**
 * Builds the event bus one plugin publishes and subscribes through.
 *
 * @remarks
 * The payload crosses unchanged but for `details.message`, the one free-text field the activity
 * convention promotes into searchable text, which is redacted here because a plugin publishing
 * directly would otherwise outlive the operation with a credential in it. `subscribeHomes` rather
 * than the bare `subscribe`, which always watches the ambient process home with no way to point it
 * elsewhere; its handler receives the full bus envelope, so this unwraps `.payload` to match the
 * bus's listener contract.
 */
function eventsFor(name: string, configDir: string): EventBusShape {
  return {
    publish: (topic, payload) => {
      publish(topic, redactPayload(payload), name, configDir);
    },
    subscribe: (topic, listener) =>
      subscribeHomes([configDir], topic, (envelope: { payload: unknown }) => listener(envelope.payload)),
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
    homes: homesFor(),
  };
}
