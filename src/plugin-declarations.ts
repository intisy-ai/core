import type { PluginManifest } from "@intisy-ai/api";
import { defineConfig } from "./config.js";
import { deployCommands } from "./command.js";
import type { CommandDef } from "./command.js";

/**
 * The file a plugin's settings live in, `config/<name>.json`.
 *
 * @remarks
 * The id unless the manifest says otherwise, which it does for a plugin whose settings file
 * predates its repository name. A surface that guesses instead writes to a file the plugin never
 * reads.
 */
export function configNameFor(manifest: PluginManifest): string {
  return manifest.config?.name || manifest.id;
}

/** What carrying out one plugin's declarations did. */
export interface AppliedDeclarations {
  /** The plugin whose manifest was applied. */
  plugin: string;
  /** The config file the settings were registered under, which is the id unless the manifest renamed it. */
  configName: string;
  /** Setting names registered from the manifest, so a surface can read them without running it. */
  settings: string[];
  /** Command files written. */
  commands: string[];
}

/**
 * The commands a plugin contributes, which is exactly what its manifest declares.
 *
 * @remarks
 * A plugin knows nothing about how its settings are edited. It declares what they ARE; whether an
 * app offers a command to change them, and what that command looks like, is the host's business,
 * and a host that offers one serves every plugin through it rather than one per plugin.
 */
export function commandsFor(manifest: PluginManifest): CommandDef[] {
  return (manifest.commands ?? []) as CommandDef[];
}

/**
 * Carries out what a set of manifests declare, without importing any of the plugins.
 *
 * @remarks
 * Takes the manifests as DATA rather than reading them, because reading a home's deployed sidecars
 * belongs to whoever drives the plugins and this library may not reference it. A host hands in what
 * it already read; the declarations then take effect for a plugin that has never been activated,
 * which is the whole point of declaring them rather than registering them by running code.
 */
export function applyManifestDeclarations(manifests: PluginManifest[], configDir?: string): AppliedDeclarations[] {
  const applied: AppliedDeclarations[] = [];
  for (const manifest of manifests) {
    if (!manifest?.id) continue;
    const defaults = manifest.config?.defaults;
    const configName = configNameFor(manifest);
    if (defaults) defineConfig(configName, defaults, configDir);
    const commands = commandsFor(manifest);
    applied.push({
      plugin: manifest.id,
      configName,
      settings: defaults ? Object.keys(defaults) : [],
      commands: commands.length > 0 ? deployCommands(manifest.id, commands) : [],
    });
  }
  return applied;
}
