# core

The shared foundation every plugin in the ecosystem builds on. Consumed as a git
submodule and bundled into each plugin (like `core-auth` / `core-loader`), so there
is no runtime install. It supersedes `core-log` (whose config + logging API lives
here now) and adds app detection, the opencode/claude hook guard, file helpers, and
a **cross-app command + config-command framework**.

## Under-the-Hood Architecture

```mermaid
flowchart TD
    PLUGIN["any plugin (utility / provider / loader)"] -->|imports + bundles| CORE["core (this repo, submodule)"]
    CORE --> ENV["env: getApp / getAppConfigDir / existingApps"]
    CORE --> CFG["config: load / get / set / list (config/<name>.json)"]
    CORE --> LOG["log: createLogger / makeWriteLog"]
    CORE --> FILES["files: atomicWrite / readJson / writeJson"]
    CORE --> HOOK["hook: isHookInvocation guard"]
    CORE --> CMD["command: deployCommands / configCommand"]
    CMD -->|writes *.md| OCDIR["~/.config/opencode/command/"]
    CMD -->|writes *.md| CCDIR["~/.claude/commands/"]
    OCDIR -->|/<plugin>-config runs| CLI["node <bundle> config …  (maybeRunConfigCli)"]
    CCDIR -->|/<plugin>-config runs| CLI
    CLI --> CFG
```

## Structure
- `src/` — `env`, `config`, `log`, `files`, `hook`, `command`, `configcli`, `index` (barrel)
- `dist/` — single bundled `index.js` (generated; not committed). The config CLI ships inside it.

## Installation (for a plugin author)
Add as a submodule and bundle it (esbuild `bundle: true`), importing from `../core/dist/index.js`:
```bash
git submodule add https://github.com/intisy-ai/core core
```
`core` is **not published to npm** — it's a bundled submodule. (Loaders/providers that already carry `core-loader`/`core-auth` can nest `core` inside those, or add it as a second submodule.)

## API
```ts
import {
  getApp, isClaude, getAppConfigDir, existingApps,                  // env
  loadConfig, defineConfig, getConfigDefaults, getConfigValue, setConfigValue, listConfig, // config
  createLogger, makeWriteLog, globalSetting,                        // log + global settings
  atomicWrite, readJson, writeJson, ensureDir,                      // files
  isHookInvocation,                                                 // hook guard
  deployCommands, configCommand, maybeRunConfigCli,                 // commands
} from "../core/dist/index.js";
```

### Commands (work in both opencode and Claude Code)
Both apps read markdown slash-commands from a directory (`<cfg>/command/` for opencode,
`<cfg>/commands/` for claude). `deployCommands(pluginName, defs)` writes each command to
**both**, so one definition works everywhere. A command may run a shell line whose output
is injected, and `{{BUNDLE}}` resolves to the plugin's deployed file:

```ts
import { deployCommands, configCommand } from "../core/dist/index.js";
deployCommands("wakatime-sync", [
  configCommand("wakatime-sync"),                         // /wakatime-sync-config (100% config)
  { name: "wakatime", description: "Today's tracked time", shell: 'node "{{BUNDLE}}" today' },
]);
```

### 100% configurable via commands
`configCommand(name)` generates a `/<name>-config` command with `list | get <key> | set <key> <value>`.
It shells into the plugin's own bundle, which must call `maybeRunConfigCli` at the top of its entry:

```ts
import { maybeRunConfigCli } from "../core/dist/index.js";
if (maybeRunConfigCli("wakatime-sync")) { /* ran as `node bundle config …`; stop here */ }
else { /* normal plugin activation */ }
```
Every key in `config/<name>.json` is then reachable (`set` coerces `true`/`false`/numbers/JSON).

## Configuration
`core` is the single config system for the ecosystem (don't hand-roll config reading):
- `loadConfig(name)` / `getConfigValue` / `setConfigValue` / `listConfig` / `coerce` read & write the
  consuming plugin's `config/<name>.json` (preferred) or `<name>.json` (fallback).
- **`defineConfig(name, defaults)`** — call on plugin load (BEFORE the `maybeRunConfigCli` guard) to
  **register** a plugin's settings + defaults. Writes **nothing** — launching never creates a config file.
  Returns the effective config (defaults + on-disk); `getConfigDefaults(name)` reads the registered defaults.
- Settings are editable through the **loader** (Plugins → Configure), which discovers core-plugins via
  `node <bundle> config schema` and saves with `config set` — the only thing that writes a file.
- **`globalSetting(key, fallback)`** — reads the GLOBAL `config/settings.json` (the opencode.json-equivalent;
  each app home has its own). Currently holds `logConsole` (mirror logs to the console) + `logColor`.

## Logging
Via `createLogger(name)` / `makeWriteLog(name)` → `<configDir>/logs/YYYY-MM-DD/<name>-HH-MM-SS.log`,
toggle with `"logging": false` in the plugin's config.

## teavm-build.mjs (generic TeaVM build harness)
A standalone Node script (not part of the bundled `dist/index.js` API — invoked directly from a
plugin's `build` script) that runs a Gradle TeaVM `generateJavaScript` task for a provider's Java
module and copies the emitted ESM to a stable path so esbuild can bundle it alongside the
provider's TS. Introduced for stub-auth (Phase 4 Task 5, the JS half of the shared-Java model);
reusable as-is by any provider with a TeaVM-compiled module (e.g. claude-code-auth/antigravity-auth
Task 6) — nothing in the script is provider-specific. Vendored here so every plugin build reaches
it reproducibly (via the `core` submodule) in CI, agentbox, and fresh clones alike.

Contract: runs `./gradlew <module>:<task>` inside `--java-dir`, locates the single non-sourcemap
`.js` file under `<java-dir>/<module-dir>/build/generated/teavm/js/`, and copies it (plus its
`.map`, if present) to `--out`. Fails loudly if the java dir/gradle wrapper is missing, the
generated-js directory doesn't exist after the build, more/fewer than one `.js` file is found, or
the staged output is empty.

Usage (run from the consuming package's own directory, with `core` as its submodule):
```bash
node core/teavm-build.mjs --java-dir java --module :stub-teavm --out src/generated/stub-provider.teavm.js
```
Flags: `--java-dir` / `--module` / `--out` (all required), `--task` (default `generateJavaScript`),
`--module-dir` (default `--module` minus its leading `:`), `--skip-build` (re-copy the
last-generated output without re-running Gradle).

## License
MIT
