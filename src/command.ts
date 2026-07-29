// @ts-nocheck
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

export interface CommandDef {
  name: string;            // slash-command name -> <name>.md
  description: string;     // shown in the command picker
  argumentHint?: string;   // e.g. "list | get <key> | set <key> <value>"
  body?: string;           // markdown the model sees (after any shell output)
  shell?: string;          // optional shell run via !`…`; may use $ARGUMENTS and {{BUNDLE}}
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
export function configCommand(pluginName: string, commandName = `${pluginName}-config`): CommandDef {
  return {
    name: commandName,
    description: `View and change ${pluginName} configuration`,
    argumentHint: "list | get <key> | set <key> <value>",
    shell: `node "{{BUNDLE}}" config $ARGUMENTS`,
    body: `Above is the result of the ${pluginName} config command. Report it to the user; if they asked to change a setting, confirm the new value.`,
  };
}
