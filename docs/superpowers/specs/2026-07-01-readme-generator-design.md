# Central README Generator — Design Spec

**Date:** 2026-07-01
**Status:** Approved (design), pending implementation plan
**Home:** `core` (the shared foundation bundled into every plugin)

## Goal

Every plugin in the intisy-ai monorepo produces its `README.md` from one central
generator, so all READMEs follow the same structure automatically and can never
drift. Each plugin authors only the small amount of prose that cannot be derived
(description, architecture diagram, structure); everything mechanical is derived
from existing programmatic sources (`package.json`, the `defineConfig` schema,
the registered commands).

## Architecture

The generator mirrors the existing `defineConfig` + `config schema` pattern: a
plugin **registers** its readme spec at module load via `defineReadme(spec)`, and
a `readme` CLI action emits the file. Assembly is an **ordered pipeline of
section renderers**, not a hardcoded template, so sections can be added in the
future without rewriting the generator (the explicit "easy to add more later"
requirement).

```
module load:  defineConfig(...)   defineReadme(...)   [CLI guard]   deployCommands(...)
                     │                   │
                     ▼                   ▼
              config registry      readme registry
                     └─────────┬─────────┘
      `node dist/index.js readme[ --check]`
                               ▼
                 generateReadme(pluginName)
                   builds ctx → runs ordered SectionRenderers → joins → README.md
```

## Components

### 1. `core/src/readme.ts` — authoring API + generator

**`defineReadme(spec)`** — registers the plugin's readme spec in a module-level
registry (keyed by plugin name), writes nothing. Called at module load, **before
the CLI guard** (like `defineConfig`). Spec shape (all fields optional except where
noted; unknown fields are ignored for forward-compatibility):

```ts
interface ReadmeSpec {
  name?: string;                 // default: package.json name
  tagline?: string;              // one-line summary under the title
  description?: string;          // full prose; default: package.json description
  architecture?: string;        // mermaid diagram BODY (the main authored content)
  structure?: { src?: string[]; dist?: string[] };  // Structure bullets
  commands?: CommandDef[];       // the SAME array passed to deployCommands (DRY)
  dependencies?: string[];       // override/annotate; default: package.json deps
  extraSections?: ExtraSection[];// per-plugin custom sections (see Extensibility)
}
interface ExtraSection { id: string; title: string; body: string; after?: string; }
```

**`generateReadme(pluginName): string`** — builds the shared context, runs the
ordered section renderers, and joins their non-null outputs with blank lines.

### 2. Section-renderer pipeline (the extensibility core)

```ts
interface SectionCtx {
  pluginName: string;
  pkg: Record<string, unknown>;          // parsed package.json
  spec: ReadmeSpec;                       // registered readme spec
  config: { defaults: object; };          // getConfigDefaults(pluginName)
  commands: CommandDef[];                 // spec.commands ?? []
  helpers: { badge; installBlock; loggingBlock; jsonExample; };
}
interface SectionRenderer { id: string; render(ctx: SectionCtx): string | null; }
```

`DEFAULT_SECTIONS: SectionRenderer[]` — the 9 mandated sections as 9 renderers, in
order:

| id | renders | source |
|----|---------|--------|
| `title` | `# name` + badges | pkg.name |
| `description` | intro paragraph | spec.description ?? pkg.description |
| `architecture` | `## Under-the-Hood Architecture` + mermaid | spec.architecture |
| `structure` | `## Structure` | spec.structure |
| `installation` | `## Installation` (plugin-updater + npm) | pkg.repository + pkg.name |
| `configuration` | `## Configuration` (JSON example + key table) | getConfigDefaults(name) |
| `commands` | `## Commands` | ctx.commands |
| `dependencies` | `## Dependencies` | spec.dependencies ?? pkg.dependencies |
| `logging` | `## Logging` (log path + toggle) | constant boilerplate |
| `license` | `## License` | MIT constant |

A renderer returning `null` is skipped (e.g. a plugin with no commands emits no
Commands section). `extraSections` are merged into the pipeline before rendering:
each is inserted immediately after the renderer whose `id === after` (default: just
before `license`).

**Adding future content is always additive:**
- New standard section for all plugins → write one renderer, insert into `DEFAULT_SECTIONS`.
- One-off section for a single plugin → add to `spec.extraSections` (no core change).
- New derived data source → add one field to `SectionCtx`; existing renderers untouched.

### 3. CLI action — `readme` / `readme --check`

Wired into the existing `node dist/index.js <action>` dispatcher (a
`maybeRunReadmeCli(pluginName)` guard placed alongside the config CLI guard, before
`deployCommands`, so generation has no deploy side effects):
- `readme` → writes `README.md` in the plugin root.
- `readme --check` → regenerates in memory and exits non-zero if it differs from the
  on-disk `README.md` (for CI). Prints a unified diff to stderr.

### 4. Build + CI integration

- Each plugin gains `"postbuild": "node dist/index.js readme"` (regenerates after
  every build). `README.md` stays committed (it is in `files`).
- The shared `publish.yml` gains a step after build: `node dist/index.js readme --check`,
  which **fails the release on drift** — no stale README can be published.

## Data flow

1. Module load registers `defineConfig` + `defineReadme` (+ commands passed to both
   `defineReadme` and `deployCommands`).
2. `readme` action → `generateReadme(name)` reads the readme registry,
   `getConfigDefaults(name)`, and `package.json` from disk; builds `ctx`; runs the
   ordered renderers; writes/checks `README.md`.

## Error handling

- Missing optional spec fields fall back (description → pkg.description; empty
  structure/commands → those sections skipped). The generator never throws on a
  well-formed spec.
- The ONLY intentional failure is `readme --check` drift (exit non-zero), which
  gates CI.

## Migration

Convert the 9 existing publishable-plugin READMEs into `defineReadme()` specs by
lifting their current description/architecture/structure, then run `readme` and
diff against the old file to confirm parity (adjust the spec until the generated
output is equivalent). Order: one plugin proves the generator end-to-end
(`wakatime-sync`), then the remaining eight.

## Testing

- `core` unit test for `generateReadme`: a fixture spec + fixture `package.json` +
  registered config → asserts all expected sections appear in the correct order and
  that a `null`-returning renderer is omitted.
- `core` unit test for the `--check` path: identical input → exit 0; mutated on-disk
  file → exit non-zero.
- The shared contract kit (`runPluginContract`) asserts each plugin's
  `readme --check` passes on a freshly generated file (catches an unmigrated plugin).

## Scope

- **In:** the 9 publishable plugins (opencode-loader, claude-code-loader,
  antigravity-auth, claude-code-auth, stub-auth, metric-dashboard, sync-bridge,
  wakatime-sync, plugin-updater) + the generator in `core`.
- **Optional/later:** `core` and `core-auth` may adopt their own generated READMEs.
- **Out:** `core-loader` is private and has no README.

## Rollout

The generator lives in `core` (a submodule), and every consumer + the shared
workflow changes — so shipping is a coordinated release: push `core`, advance each
consumer's `core` pointer, regenerate READMEs, version-bump, tag. Same shape as the
release cut on 2026-07-01.
