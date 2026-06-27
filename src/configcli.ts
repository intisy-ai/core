// @ts-nocheck
// The config CLI behind the `/<plugin>-config` slash command. A plugin's deployed
// bundle calls maybeRunConfigCli(name) at the top of its entry: when invoked as
// `node <bundle> config <list|get|set> …` it runs this and the plugin exits; when
// loaded normally (as a plugin hook) it returns false and the plugin runs as usual.
// This is what makes every config key reachable from both apps with no global CLI.

import { listConfig, getConfigValue, setConfigValue, coerce, getConfigDefaults } from "./config.js";

export function runConfigCli(pluginName: string, argv: string[]): void {
  const [action, key, ...rest] = argv;
  // `schema` is the machine-readable form the loader's Configure screen reads: it lists
  // every editable setting (declared defaults) alongside the current on-disk values.
  if (action === "schema") {
    console.log(JSON.stringify({ name: pluginName, defaults: getConfigDefaults(pluginName), current: listConfig(pluginName) }));
    return;
  }
  if (!action || action === "list") {
    const defaults = getConfigDefaults(pluginName);
    const current = listConfig(pluginName);
    const keys = Object.keys({ ...defaults, ...current });
    if (!keys.length) { console.log(`${pluginName}: no configurable settings.`); return; }
    for (const k of keys) {
      const isSet = Object.prototype.hasOwnProperty.call(current, k);
      console.log(`${k} = ${JSON.stringify(isSet ? current[k] : defaults[k])}${isSet ? "" : "  (default)"}`);
    }
    return;
  }
  if (action === "get") {
    if (!key) { console.log("usage: get <key>"); return; }
    console.log(`${key} = ${JSON.stringify(getConfigValue(pluginName, key))}`);
    return;
  }
  if (action === "set") {
    if (!key || rest.length === 0) { console.log("usage: set <key> <value>"); return; }
    const value = coerce(rest.join(" "));
    setConfigValue(pluginName, key, value);
    console.log(`set ${key} = ${JSON.stringify(value)}`);
    return;
  }
  console.log(`${pluginName} config — usage: list | get <key> | set <key> <value> | schema`);
}

export function maybeRunConfigCli(pluginName: string): boolean {
  const argv = process.argv.slice(2);
  if (argv[0] !== "config") return false;
  try { runConfigCli(pluginName, argv.slice(1)); }
  catch (e: unknown) { console.error(String((e as { message?: string }).message ?? e)); }
  return true;
}
