// Unified config dispatcher behind the `/config` slash-command. Reaches the ENTIRE
// ecosystem config from one entry: global settings (config/settings.json, the reserved
// name "settings") plus every installed plugin's settings. UI is impossible in both host
// apps, so this is the complete text-command surface. The caller (a loader) supplies the
// names its home declares; this module stays app-agnostic.
//
// Everything is served in-process. Spawning a plugin to ask it about its own settings was only
// ever necessary because the defaults lived in that plugin's module instance; a manifest that
// declares them puts them here instead, so a broken or unbuildable plugin's settings stay editable.

import { runConfigCli } from "./configcli.js";
import { withCause } from "./activity-context.js";
import { GLOBAL_SETTINGS_DEFAULTS, registerGlobalSettings } from "./global-settings.js";

export { GLOBAL_SETTINGS_DEFAULTS };
const GLOBAL_NAME = "settings";

/** What the cross-plugin settings command needs to know about the host it is running in. */
export interface AllConfigOptions {
  /** The config names this home declares, already registered by whoever read the manifests. */
  plugins: string[];
}

function msg(e: unknown): string {
  return String((e as { message?: string })?.message ?? e);
}

function dispatchAllConfigCli(argv: string[], opts: AllConfigOptions): void {
  // register global defaults + field types so `global list/schema` enumerates them (writes nothing)
  registerGlobalSettings();
  const declared = new Set(opts.plugins);
  const [target, ...rest] = argv;

  if (!target || target === "list") {
    console.log("# global");
    runConfigCli(GLOBAL_NAME, ["list"]);
    for (const name of opts.plugins) {
      console.log(`\n# ${name}`);
      try { runConfigCli(name, ["list"]); }
      catch (e) { console.log(`  (could not read ${name}: ${msg(e)})`); }
    }
    return;
  }

  if (target === "global") {
    runConfigCli(GLOBAL_NAME, rest.length ? rest : ["list"]);
    return;
  }

  if (!declared.has(target)) {
    console.log(`Unknown config target: ${target}`);
    return;
  }
  try { runConfigCli(target, rest.length ? rest : ["list"]); }
  catch (e) { console.log(`config ${target} failed: ${msg(e)}`); }
}

/**
 * Runs the settings command that reaches every plugin, not just one.
 *
 * @param argv the command arguments.
 * @param opts where to look for plugins and how to probe them.
 */
export function runAllConfigCli(argv: string[], opts: AllConfigOptions): void {
  withCause({ kind: "user", surface: "config", detail: argv[0] || "list" }, () => dispatchAllConfigCli(argv, opts));
}
