import type { PluginManifest } from "@intisy-ai/api";
import { defineConfig } from "./config.js";
import { configCommand, deployCommands } from "./command.js";
import type { CommandDef } from "./command.js";

/** What carrying out one plugin's declarations did. */
export interface AppliedDeclarations {
  plugin: string;
  /** Setting names registered from the manifest, so a surface can read them without running it. */
  settings: string[];
  /** Command files written. */
  commands: string[];
}

/**
 * Every command a plugin gets, which is what it declares plus the one core generates for it.
 *
 * @remarks
 * A plugin that ships settings always gets a command to edit them, so no manifest restates the
 * same entry and no plugin can ship settings a user has no way to reach.
 */
export function commandsFor(manifest: PluginManifest): CommandDef[] {
  const declared = (manifest.commands ?? []) as CommandDef[];
  if (!manifest.config) return declared;
  const generated = configCommand(manifest.id);
  return declared.some((command) => command.name === generated.name) ? declared : [generated, ...declared];
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
    if (defaults) defineConfig(manifest.id, defaults, configDir);
    const commands = commandsFor(manifest);
    applied.push({
      plugin: manifest.id,
      settings: defaults ? Object.keys(defaults) : [],
      commands: commands.length > 0 ? deployCommands(manifest.id, commands) : [],
    });
  }
  return applied;
}
