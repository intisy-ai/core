// Cross-app slash-command framework. Both opencode and Claude Code read markdown
// slash-commands from a dir (opencode: <cfg>/command/, claude: <cfg>/commands/), so
// one command definition deploys to BOTH. A command may run a shell line (`!`…``,
// supported in both apps) whose stdout is injected into the prompt; that's how a
// command performs an action or edits config. {{BUNDLE}} in `shell` is replaced
// with the plugin's deployed bundle path, so a command can invoke the plugin's own
// config CLI (see configcli.ts) with no global install.

import { join } from "path";
import { atomicWrite } from "./files.js";
import { existingApps } from "./env.js";

/** One slash command as it is deployed into an app. */
export interface CommandDef {
  /** Command name, which becomes the deployed file name. */
  name: string;
  /** One line shown in the command picker. */
  description: string;
  /** Hint describing the arguments, for example `list | get <key> | set <key> <value>`. */
  argumentHint?: string;
  /** Markdown the model sees, after any shell output. */
  body?: string;
  /** Shell run before the body, which may use `$ARGUMENTS` and the bundle placeholder. */
  shell?: string;
}

function render(def: CommandDef, bundlePath: string): string {
  const fm = ["---", `description: ${def.description}`];
  if (def.argumentHint) fm.push(`argument-hint: ${def.argumentHint}`);
  fm.push("---", "");
  const lines = [fm.join("\n")];
  if (def.shell) lines.push("!`" + def.shell.replace(/\{\{BUNDLE\}\}/g, bundlePath) + "`", "");
  lines.push(def.body || "");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// the plugin's deployed bundle in a given config dir (its config-CLI entry point)
function bundlePath(configDir: string, pluginName: string): string {
  return join(configDir, "plugin", `${pluginName}.js`);
}

// Write every command for `pluginName` into each installed app's command dir.
// Idempotent (overwrites). Returns the files written.
/**
 * Writes one plugin commands into the app command directory.
 *
 * @param pluginName the plugin contributing them.
 * @param defs the commands to write.
 * @returns the paths written.
 */
export function deployCommands(pluginName: string, defs: CommandDef[]): string[] {
  const written: string[] = [];
  for (const { configDir, commandDir } of existingApps()) {
    const dir = join(configDir, commandDir);
    for (const def of defs) {
      const file = join(dir, `${def.name}.md`);
      atomicWrite(file, render(def, bundlePath(configDir, pluginName)));
      written.push(file);
    }
  }
  return written;
}

// Convenience: the standard "100% configurable" command for a plugin. Runs the
// plugin's own bundle in config-CLI mode (list/get/set); see maybeRunConfigCli.
/**
 * The settings command every plugin built on this library gets for free.
 *
 * @param pluginName the plugin the command edits.
 * @param commandName what to call it.
 * @returns the command definition, ready to deploy.
 */
export function configCommand(pluginName: string, commandName = `${pluginName}-config`): CommandDef {
  return {
    name: commandName,
    description: `View and change ${pluginName} configuration`,
    argumentHint: "list | get <key> | set <key> <value>",
    shell: `node "{{BUNDLE}}" config $ARGUMENTS`,
    body: `Above is the result of the ${pluginName} config command. Report it to the user; if they asked to change a setting, confirm the new value.`,
  };
}
