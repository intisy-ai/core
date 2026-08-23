// @ts-nocheck
// Unified config dispatcher behind the `/config` slash-command. Reaches the ENTIRE
// ecosystem config from one entry: global settings (config/settings.json, the reserved
// name "settings") plus every installed plugin's own config CLI. UI is impossible in
// both host apps, so this is the complete text-command surface. The caller (plugin-updater)
// supplies the installed-plugin list and a bundle resolver; this module stays app-agnostic.

import { execFileSync } from "child_process";
import { runConfigCli } from "./configcli.js";
import { withCause, activityEnv } from "./activity-context.js";
import { GLOBAL_SETTINGS_DEFAULTS, registerGlobalSettings } from "./global-settings.js";

export { GLOBAL_SETTINGS_DEFAULTS };
const GLOBAL_NAME = "settings";

export interface AllConfigOptions {
  plugins: string[];
  /**
   * Plugins whose settings this process already knows, from their manifest.
   *
   * @remarks
   * Served in-process. Spawning a plugin to ask it about its own settings was only ever necessary
   * because the defaults lived in that plugin's module instance; a manifest that declares them puts
   * them here instead, so a broken or unbuildable plugin's settings stay editable.
   */
  declared?: string[];
  resolveBundle?: (name: string) => string | null;
  runChild?: (bundle: string, args: string[]) => string;
}

// A plugin's config CLI runs in a fresh process that reads the trace from its
// environment at module load, so the trace has to be on the env before the spawn.
function defaultRunChild(bundle: string, args: string[]): string {
  return execFileSync(process.execPath, [bundle, "config", ...args], { encoding: "utf8", env: { ...process.env, ...activityEnv() } });
}

function msg(e: unknown): string {
  return String((e as { message?: string })?.message ?? e);
}

function dispatchAllConfigCli(argv: string[], opts: AllConfigOptions): void {
  // register global defaults + field types so `global list/schema` enumerates them (writes nothing)
  registerGlobalSettings();
  const runChild = opts.runChild ?? defaultRunChild;
  const declared = new Set(opts.declared ?? []);
  const [target, ...rest] = argv;

  const serve = (name: string, args: string[]): void => {
    if (declared.has(name)) {
      runConfigCli(name, args);
      return;
    }
    const bundle = opts.resolveBundle?.(name);
    if (!bundle) { console.log(`  (nothing declares ${name}'s settings)`); return; }
    process.stdout.write(runChild(bundle, args));
  };

  if (!target || target === "list") {
    console.log("# global");
    runConfigCli(GLOBAL_NAME, ["list"]);
    for (const name of opts.plugins) {
      const bundle = opts.resolveBundle(name);
      if (!bundle) continue;
      console.log(`\n# ${name}`);
      try { process.stdout.write(runChild(bundle, ["list"])); }
      catch (e) { console.log(`  (could not read ${name}: ${msg(e)})`); }
    }
    return;
  }

  if (target === "global") {
    runConfigCli(GLOBAL_NAME, rest.length ? rest : ["list"]);
    return;
  }

  if (!declared.has(target) && !opts.resolveBundle?.(target)) {
    console.log(`Unknown config target: ${target}`);
    return;
  }
  try { serve(target, rest.length ? rest : ["list"]); }
  catch (e) { console.log(`config ${target} failed: ${msg(e)}`); }
}

export function runAllConfigCli(argv: string[], opts: AllConfigOptions): void {
  withCause({ kind: "user", surface: "config", detail: argv[0] || "list" }, () => dispatchAllConfigCli(argv, opts));
}
