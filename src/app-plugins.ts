import fs from "node:fs";
import path from "node:path";
import type { AppDescriptor } from "./apps.js";

/** Where a registration landed, and whether it had to change anything. */
export interface AppPluginRegistration {
  /** The file the registration was written to. */
  target: string;
  /** Whether the file actually changed, so a caller can stay quiet when nothing did. */
  changed: boolean;
}

const PLUGIN_TOKEN = "{plugin}";

function readJsonFile(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\s*\/\/[^\n]*/gm, ""));
  } catch {
    return null;
  }
}

/**
 * The config file an app's plugin list lives in.
 *
 * @remarks
 * An app that reads several names must not gain a second file: the first declared name that
 * already exists wins, and only a home with none of them falls back to declaring the first.
 */
export function resolveAppConfigFile(
  configDir: string,
  files: string[],
  exists: (p: string) => boolean = fs.existsSync,
): string {
  for (const name of files) {
    const candidate = path.join(configDir, name);
    if (exists(candidate)) return candidate;
  }
  return path.join(configDir, files[0] ?? "config.json");
}

/**
 * Inserts `pluginName` as the first entry of the root `key` array, editing the raw text in place.
 *
 * @remarks
 * A `JSON.stringify` rewrite would strip the `//` comments and formatting a hand-edited config
 * carries, so the array is opened by text match instead. `hasKey` comes from the PARSED root, so a
 * nested key of the same name or one inside a string cannot select the wrong branch. Returns null
 * when the text cannot be edited safely, which is the caller's signal to fall back to a JSON write.
 */
export function insertPluginIntoJsonc(raw: string, pluginName: string, key: string, hasKey: boolean): string | null {
  const entry = JSON.stringify(pluginName);
  const quotedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (hasKey) {
    const anchored = new RegExp(`^[ \\t]*"${quotedKey}"\\s*:\\s*\\[`, "m");
    const anywhere = new RegExp(`"${quotedKey}"\\s*:\\s*\\[`);
    const match = raw.match(anchored) ?? raw.match(anywhere);
    if (!match || match.index === undefined) return null;
    const at = match.index + match[0].length;
    const rest = raw.slice(at);
    return raw.slice(0, at) + (/^\s*\]/.test(rest) ? entry : `${entry}, `) + rest;
  }

  const brace = raw.indexOf("{");
  if (brace === -1) return null;
  const afterBrace = raw.slice(brace + 1);
  if (/^\s*}/.test(afterBrace)) {
    return raw.slice(0, brace + 1) + `\n  ${JSON.stringify(key)}: [${entry}]\n` + afterBrace;
  }
  return raw.slice(0, brace + 1) + `\n  ${JSON.stringify(key)}: [${entry}],` + afterBrace;
}

function listedAlready(entries: unknown[], pluginName: string): boolean {
  return entries.some((entry) =>
    entry === pluginName
    || (typeof entry === "string" && entry.startsWith(`${pluginName}@`))
    || (Array.isArray(entry) && entry[0] === pluginName));
}

function registerInPluginList(
  configDir: string,
  npmPlugins: NonNullable<AppDescriptor["npmPlugins"]>,
  pluginName: string,
): AppPluginRegistration {
  const target = resolveAppConfigFile(configDir, npmPlugins.configFiles);
  const key = npmPlugins.pluginsKey;
  const exists = fs.existsSync(target);
  const raw = exists ? fs.readFileSync(target, "utf8") : "";
  const parsed = exists ? readJsonFile(target) : null;
  const listed = Array.isArray(parsed?.[key]) ? (parsed[key] as unknown[]) : [];
  if (listedAlready(listed, pluginName)) return { target, changed: false };

  if (exists && raw.trim()) {
    const edited = insertPluginIntoJsonc(raw, pluginName, key, Array.isArray(parsed?.[key]));
    if (edited) {
      fs.writeFileSync(target, edited, "utf8");
      return { target, changed: true };
    }
  }
  const config = (parsed ?? {}) as Record<string, unknown>;
  config[key] = [pluginName, ...listed];
  if (npmPlugins.schemaUrl && !config.$schema) config.$schema = npmPlugins.schemaUrl;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(config, null, 2), "utf8");
  return { target, changed: true };
}

function fillTemplate(template: unknown, pluginName: string): unknown {
  if (typeof template === "string") return template.split(PLUGIN_TOKEN).join(pluginName);
  if (Array.isArray(template)) return template.map((item) => fillTemplate(item, pluginName));
  if (template && typeof template === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template)) out[key] = fillTemplate(value, pluginName);
    return out;
  }
  return template;
}

function registerAsStartupHook(
  configDir: string,
  hook: NonNullable<AppDescriptor["startupHook"]>,
  pluginName: string,
): AppPluginRegistration {
  const target = path.join(configDir, hook.file);
  const root = (fs.existsSync(target) ? readJsonFile(target) : {}) ?? {};

  let container: Record<string, unknown> = root;
  for (const step of hook.path.slice(0, -1)) {
    const next = container[step];
    container[step] = next && typeof next === "object" && !Array.isArray(next) ? next : {};
    container = container[step] as Record<string, unknown>;
  }
  const leaf = hook.path[hook.path.length - 1];
  if (!leaf) return { target, changed: false };
  const existing = Array.isArray(container[leaf]) ? (container[leaf] as unknown[]) : [];
  // The entry's shape is the app's, not ours, so presence is asked of the serialized array
  // rather than by matching a structure this deliberately does not model.
  if (JSON.stringify(existing).includes(pluginName)) return { target, changed: false };

  container[leaf] = [...existing, fillTemplate(hook.entry, pluginName)];
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(root, null, 2), "utf8");
  return { target, changed: true };
}

/**
 * Makes an app load `pluginName` on its own next start.
 *
 * @remarks
 * Both mechanisms are declared by the app rather than known here: a plugin list when the app has
 * one, a startup hook otherwise. Returns null when the descriptor declares neither, which is an
 * app that auto-loads nothing rather than a failure. Nothing prints, so a host embedding this
 * cannot corrupt its own stdout.
 */
export function registerPluginWithApp(
  configDir: string,
  desc: AppDescriptor | null | undefined,
  pluginName: string,
): AppPluginRegistration | null {
  if (!desc) return null;
  if (desc.npmPlugins) return registerInPluginList(configDir, desc.npmPlugins, pluginName);
  if (desc.startupHook) return registerAsStartupHook(configDir, desc.startupHook, pluginName);
  return null;
}
