// @ts-nocheck
// Unified config dispatcher behind the `/config` slash-command. Reaches the ENTIRE
// ecosystem config from one entry: global settings (config/settings.json, the reserved
// name "settings") plus every installed plugin's own config CLI. UI is impossible in
// both host apps, so this is the complete text-command surface. The caller (plugin-updater)
// supplies the installed-plugin list and a bundle resolver; this module stays app-agnostic.

import { execFileSync } from "child_process";
import { defineConfig } from "./config.js";
import { runConfigCli } from "./configcli.js";

export const GLOBAL_SETTINGS_DEFAULTS = { logConsole: false, logColor: true };
const GLOBAL_NAME = "settings";

export interface AllConfigOptions {
  plugins: string[];
  resolveBundle: (name: string) => string | null;
  runChild?: (bundle: string, args: string[]) => string;
}

function defaultRunChild(bundle: string, args: string[]): string {
  return execFileSync(process.execPath, [bundle, "config", ...args], { encoding: "utf8" });
}

function msg(e: unknown): string {
  return String((e as { message?: string })?.message ?? e);
}

export function runAllConfigCli(argv: string[], opts: AllConfigOptions): void {
  // register global defaults so `global list/schema` enumerates them (writes nothing)
  defineConfig(GLOBAL_NAME, GLOBAL_SETTINGS_DEFAULTS);
  const runChild = opts.runChild ?? defaultRunChild;
  const [target, ...rest] = argv;

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

  const bundle = opts.resolveBundle(target);
  if (!bundle) { console.log(`Unknown config target: ${target}`); return; }
  try { process.stdout.write(runChild(bundle, rest.length ? rest : ["list"])); }
  catch (e) { console.log(`config ${target} failed: ${msg(e)}`); }
}
