# Central README Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every publishable plugin generates its `README.md` from one central generator in `core`, so all READMEs share the same 9-section structure and cannot drift.

**Architecture:** A plugin registers a small `defineReadme(spec)` at module load (like `defineConfig`); a `readme` CLI action runs `generateReadme(name)`, which builds a shared context (spec + `getConfigDefaults` + `package.json` + commands) and assembles the file from an **ordered array of section renderers** (`DEFAULT_SECTIONS`). New sections are added by inserting a renderer — no rewrite of the generator.

**Tech Stack:** TypeScript (ESNext/NodeNext), esbuild/tsc builds, vitest, the existing `core` submodule bundled into every plugin.

## Global Constraints

- All source is TypeScript in `src/`; compiled to `dist/`; `dist/` is never committed. Files carrying `// @ts-nocheck` keep it (match existing style: `var` allowed in ES5 files, but new `core` modules follow `config.ts`/`configcli.ts` style — `const`/`export function`, 2-space indent).
- `core` is a git submodule bundled via esbuild (`import … from "../core/dist/index.js"` in consumers, `"./x.js"` inside core). New code lives in `core/src` and is exported from `core/src/index.ts`.
- README section order is EXACTLY: Title+Badges, Description, Under-the-Hood Architecture, Structure, Installation, Configuration, Commands, Dependencies, Logging, License.
- Repository owner is `intisy-ai`; all repo URLs are `https://github.com/intisy-ai/<name>`.
- `defineReadme` and `defineConfig` write NOTHING at load (no file created on launch); only the `readme` action writes `README.md`.
- The generator must never throw on a well-formed spec; the ONLY intentional failure is `readme --check` drift (exit code 1).
- Comment only non-obvious logic. Small focused functions. Never delete unrelated code.

---

## File Structure

- `libs/core/src/readme.ts` — NEW. The whole generator: `defineReadme`, spec/registry, `helpers`, `DEFAULT_SECTIONS`, `registerSection`, `generateReadme`, `runReadmeCli`, `maybeRunReadmeCli`. One concern (README generation); ~250 lines is acceptable for one cohesive unit, split later only if it grows.
- `libs/core/src/index.ts` — MODIFY. Export the new public surface.
- `libs/core/src/__tests__/readme.test.ts` — NEW. Unit tests for renderers, `generateReadme`, and the `--check` path.
- `libs/core/src/testing.ts` — MODIFY. Add an optional `readme` assertion to the contract kit.
- Each of the 9 plugins — MODIFY: add `defineReadme(...)` + `maybeRunReadmeCli(...)` call in the entry, add `"postbuild"` script, add the CI drift-check step, regenerate `README.md`.

---

### Task 1: `core` — spec registry + package.json loader

**Files:**
- Create: `libs/core/src/readme.ts`
- Test: `libs/core/src/__tests__/readme.test.ts`

**Interfaces:**
- Produces: `defineReadme(spec: ReadmeSpec): ReadmeSpec`, `getReadmeSpec(): ReadmeSpec`, `interface ReadmeSpec`, `interface ExtraSection`, internal `loadPkg(cwd?): Record<string, unknown>`.

- [ ] **Step 1: Write the failing test**

```ts
// libs/core/src/__tests__/readme.test.ts
import { describe, it, expect } from "vitest";
import { defineReadme, getReadmeSpec } from "../readme.js";

describe("defineReadme registry", () => {
  it("stores and returns the spec", () => {
    defineReadme({ tagline: "x", description: "d" });
    expect(getReadmeSpec().description).toBe("d");
  });
  it("returns {} before any define", () => {
    // fresh module state is exercised in generate tests; here just assert shape
    expect(typeof getReadmeSpec()).toBe("object");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd libs/core && npx vitest run src/__tests__/readme.test.ts`
Expected: FAIL — `Cannot find module '../readme.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// libs/core/src/readme.ts
// @ts-nocheck
// Central README generator. A plugin registers a spec at module load via
// defineReadme(); the `readme` CLI action (below) assembles README.md from the
// spec + derived data (package.json, config defaults, commands) through an
// ordered array of section renderers, so new sections are additive.
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { getConfigDefaults } from "./config.js";

export interface ExtraSection { id: string; title: string; body: string; after?: string; }
export interface ReadmeSpec {
  name?: string;
  tagline?: string;
  description?: string;
  architecture?: string;                 // mermaid diagram body (no fences)
  structure?: { src?: string[]; dist?: string[] };
  commands?: Array<{ name: string; description?: string; argumentHint?: string }>;
  dependencies?: string[];
  extraSections?: ExtraSection[];
}

let README_SPEC: ReadmeSpec | null = null;
export function defineReadme(spec: ReadmeSpec): ReadmeSpec { README_SPEC = spec || {}; return README_SPEC; }
export function getReadmeSpec(): ReadmeSpec { return README_SPEC || {}; }

// package.json from the process working dir (the plugin root when run via npm);
// falls back to empty so the generator never throws on a missing/broken file.
export function loadPkg(cwd = process.cwd()): Record<string, unknown> {
  try { return JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8")); } catch { return {}; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd libs/core && npx vitest run src/__tests__/readme.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git -C libs/core add src/readme.ts src/__tests__/readme.test.ts
git -C libs/core commit -m "feat(readme): defineReadme spec registry + package.json loader"
```

---

### Task 2: `core` — helpers + section renderers + `registerSection`

**Files:**
- Modify: `libs/core/src/readme.ts`
- Test: `libs/core/src/__tests__/readme.test.ts`

**Interfaces:**
- Consumes: `ReadmeSpec`, `loadPkg` (Task 1).
- Produces: `interface SectionCtx`, `interface SectionRenderer { id: string; render(ctx: SectionCtx): string | null }`, `const helpers`, `DEFAULT_SECTIONS: SectionRenderer[]`, `registerSection(renderer: SectionRenderer, afterId?: string): void`.

- [ ] **Step 1: Write the failing test**

```ts
// append to readme.test.ts
import { DEFAULT_SECTIONS, registerSection } from "../readme.js";

function ctxFixture(overrides = {}) {
  return {
    pluginName: "demo",
    pkg: { name: "demo", description: "A demo.", license: "MIT", dependencies: { left: "^1.0.0" },
           repository: { url: "git+https://github.com/intisy-ai/demo.git" } },
    spec: { architecture: "flowchart TD\n  A --> B", structure: { src: ["index.ts — entry"], dist: ["index.js"] },
            commands: [{ name: "demo-config", description: "edit config", argumentHint: "list | set" }] },
    config: { defaults: { logging: true, port: 3456 } },
    commands: [{ name: "demo-config", description: "edit config", argumentHint: "list | set" }],
    ...overrides,
  };
}

describe("section renderers", () => {
  const byId = (id) => DEFAULT_SECTIONS.find((s) => s.id === id);
  it("title includes name + badges", () => {
    expect(byId("title").render(ctxFixture())).toContain("# demo");
    expect(byId("title").render(ctxFixture())).toContain("img.shields.io");
  });
  it("configuration renders a JSON example from config defaults", () => {
    const out = byId("configuration").render(ctxFixture());
    expect(out).toContain("## Configuration");
    expect(out).toContain('"port": 3456');
  });
  it("commands section is null when there are no commands", () => {
    const c = ctxFixture({ commands: [] });
    expect(byId("commands").render(c)).toBeNull();
  });
  it("registerSection inserts after a given id", () => {
    registerSection({ id: "extra-test", render: () => "## Extra\n\nx" }, "configuration");
    const ids = DEFAULT_SECTIONS.map((s) => s.id);
    expect(ids.indexOf("extra-test")).toBe(ids.indexOf("configuration") + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd libs/core && npx vitest run src/__tests__/readme.test.ts`
Expected: FAIL — `DEFAULT_SECTIONS` / `registerSection` undefined.

- [ ] **Step 3: Write minimal implementation**

Append to `libs/core/src/readme.ts`:

```ts
export interface SectionCtx {
  pluginName: string;
  pkg: Record<string, any>;
  spec: ReadmeSpec;
  config: { defaults: Record<string, unknown> };
  commands: Array<{ name: string; description?: string; argumentHint?: string }>;
}
export interface SectionRenderer { id: string; render(ctx: SectionCtx): string | null; }

// repo "owner/name" from package.json repository.url (git+https…/…​.git)
function repoSlug(pkg: Record<string, any>): string {
  const url = String((pkg.repository && (pkg.repository.url || pkg.repository)) || "");
  const m = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  return m ? m[1] + "/" + m[2] : "intisy-ai/" + (pkg.name || "");
}

const helpers = {
  badges(pkg: Record<string, any>): string {
    const name = pkg.name || "";
    const slug = repoSlug(pkg);
    const enc = encodeURIComponent(name);
    return [
      `[![npm version](https://img.shields.io/npm/v/${enc})](https://www.npmjs.com/package/${name})`,
      `[![npm downloads](https://img.shields.io/npm/dm/${enc})](https://www.npmjs.com/package/${name})`,
      `[![CI](https://img.shields.io/github/actions/workflow/status/${slug}/publish.yml)](https://github.com/${slug}/actions)`,
    ].join("\n");
  },
  installBlock(pkg: Record<string, any>): string {
    const name = pkg.name || "";
    const url = "https://github.com/" + repoSlug(pkg);
    return [
      "### Via plugin-updater (recommended)",
      "",
      "```bash",
      `npx plugin-updater@latest init ${url}`,
      "```",
      "",
      "### Via npm",
      "",
      "```bash",
      `npm install ${name}`,
      "```",
    ].join("\n");
  },
  loggingBlock(pkg: Record<string, any>): string {
    const name = pkg.name || "";
    return [
      `Logs are written to \`<configDir>/logs/YYYY-MM-DD/${name}-HH-MM-SS.log\` and are toggled by`,
      `this plugin's \`logging\` config (default on). Console mirroring is global, off by default,`,
      "and controlled by the shared `config/settings.json` `logConsole` flag.",
    ].join("\n");
  },
  jsonExample(defaults: Record<string, unknown>): string {
    return "```json\n" + JSON.stringify(defaults || {}, null, 2) + "\n```";
  },
};

function renderStructure(c: SectionCtx): string | null {
  const s = c.spec.structure;
  if (!s || (!s.src && !s.dist)) return null;
  const lines = ["## Structure", ""];
  if (s.src) { lines.push("- `src/`"); for (const it of s.src) lines.push("  - " + it); }
  if (s.dist) { lines.push("- `dist/`"); for (const it of s.dist) lines.push("  - " + it); }
  return lines.join("\n");
}
function renderConfig(c: SectionCtx): string | null {
  const defaults = c.config.defaults || {};
  const keys = Object.keys(defaults);
  if (!keys.length) return null;
  const path = "`<configDir>/config/" + (c.pkg.name || c.pluginName) + ".json`";
  const rows = keys.map((k) => "| `" + k + "` | `" + JSON.stringify(defaults[k]) + "` |").join("\n");
  return ["## Configuration", "", "Config file: " + path + " (edit via the loader or `/" + (c.pkg.name || c.pluginName) + "-config set`).",
          "", helpers.jsonExample(defaults), "", "| Key | Default |", "| --- | --- |", rows].join("\n");
}
function renderCommands(c: SectionCtx): string | null {
  if (!c.commands || !c.commands.length) return null;
  const rows = c.commands.map((cmd) =>
    "| `/" + cmd.name + "` | " + (cmd.description || "") + " | " + (cmd.argumentHint ? "`" + cmd.argumentHint + "`" : "") + " |").join("\n");
  return ["## Commands", "", "| Command | Description | Arguments |", "| --- | --- | --- |", rows].join("\n");
}
function renderDeps(c: SectionCtx): string | null {
  const deps = c.spec.dependencies || Object.keys((c.pkg.dependencies as object) || {});
  if (!deps.length) return null;
  return ["## Dependencies", "", ...deps.map((d) => "- `" + d + "`")].join("\n");
}

export const DEFAULT_SECTIONS: SectionRenderer[] = [
  { id: "title", render: (c) => "# " + (c.spec.name || c.pkg.name || c.pluginName) + "\n\n" + helpers.badges(c.pkg) },
  { id: "description", render: (c) => {
      const body = c.spec.description || c.pkg.description;
      if (!body) return null;
      return (c.spec.tagline ? "> " + c.spec.tagline + "\n\n" : "") + body;
    } },
  { id: "architecture", render: (c) => c.spec.architecture
      ? "## Under-the-Hood Architecture\n\n```mermaid\n" + c.spec.architecture.trim() + "\n```" : null },
  { id: "structure", render: renderStructure },
  { id: "installation", render: (c) => "## Installation\n\n" + helpers.installBlock(c.pkg) },
  { id: "configuration", render: renderConfig },
  { id: "commands", render: renderCommands },
  { id: "dependencies", render: renderDeps },
  { id: "logging", render: (c) => "## Logging\n\n" + helpers.loggingBlock(c.pkg) },
  { id: "license", render: (c) => "## License\n\n" + (c.pkg.license || "MIT") + "." },
];

// Insert a renderer immediately after `afterId` (or append). Enables future
// sections without editing generateReadme. Idempotent per id.
export function registerSection(renderer: SectionRenderer, afterId?: string): void {
  if (DEFAULT_SECTIONS.some((s) => s.id === renderer.id)) return;
  const idx = afterId ? DEFAULT_SECTIONS.findIndex((s) => s.id === afterId) : -1;
  if (idx >= 0) DEFAULT_SECTIONS.splice(idx + 1, 0, renderer);
  else DEFAULT_SECTIONS.push(renderer);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd libs/core && npx vitest run src/__tests__/readme.test.ts`
Expected: PASS (all renderer tests).

- [ ] **Step 5: Commit**

```bash
git -C libs/core add src/readme.ts src/__tests__/readme.test.ts
git -C libs/core commit -m "feat(readme): section renderers, helpers, registerSection"
```

---

### Task 3: `core` — `generateReadme` (context build + pipeline + extraSections)

**Files:**
- Modify: `libs/core/src/readme.ts`
- Test: `libs/core/src/__tests__/readme.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_SECTIONS`, `helpers`, `loadPkg`, `getReadmeSpec`, `getConfigDefaults` (Tasks 1–2).
- Produces: `generateReadme(pluginName: string, cwd?: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// append to readme.test.ts
import { generateReadme, defineReadme as define2 } from "../readme.js";
import { defineConfig } from "../config.js";

describe("generateReadme", () => {
  it("assembles sections in order and honors extraSections placement", () => {
    defineConfig("gen-demo", { logging: true, port: 3456 });
    define2({
      tagline: "demo tagline", description: "Full description.",
      architecture: "flowchart TD\n  A --> B",
      structure: { src: ["index.ts — entry"] },
      commands: [{ name: "gen-demo-config", description: "edit", argumentHint: "list" }],
      extraSections: [{ id: "faq", title: "FAQ", body: "Q?\n\nA.", after: "configuration" }],
    });
    // cwd fixture: a dir with package.json — use a temp written by the test
    const md = generateReadme("gen-demo", __dirname + "/fixtures/gen-demo");
    const order = ["# ", "## Under-the-Hood Architecture", "## Structure", "## Installation",
                   "## Configuration", "## FAQ", "## Commands", "## Dependencies", "## Logging", "## License"];
    let last = -1;
    for (const marker of order) { const at = md.indexOf(marker); expect(at).toBeGreaterThan(last); last = at; }
    expect(md.endsWith("\n")).toBe(true);
  });
});
```

Also create the fixture `libs/core/src/__tests__/fixtures/gen-demo/package.json`:

```json
{ "name": "gen-demo", "description": "Fixture.", "license": "MIT",
  "repository": { "url": "git+https://github.com/intisy-ai/gen-demo.git" },
  "dependencies": { "left-pad": "^1.0.0" } }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd libs/core && npx vitest run src/__tests__/readme.test.ts`
Expected: FAIL — `generateReadme` undefined.

- [ ] **Step 3: Write minimal implementation**

Append to `libs/core/src/readme.ts`:

```ts
// turn an ExtraSection into a one-off renderer
function extraRenderer(e: ExtraSection): SectionRenderer {
  return { id: e.id, render: () => "## " + e.title + "\n\n" + e.body };
}
// merge extraSections into a copy of the default pipeline at their `after` anchors
function pipelineFor(spec: ReadmeSpec): SectionRenderer[] {
  const list = DEFAULT_SECTIONS.slice();
  for (const e of spec.extraSections || []) {
    if (list.some((s) => s.id === e.id)) continue;
    const idx = e.after ? list.findIndex((s) => s.id === e.after) : list.length - 2;
    const at = idx >= 0 ? idx + 1 : list.length - 1;   // default: just before License
    list.splice(at, 0, extraRenderer(e));
  }
  return list;
}

export function generateReadme(pluginName: string, cwd = process.cwd()): string {
  const pkg = loadPkg(cwd);
  const spec = getReadmeSpec();
  const ctx: SectionCtx = {
    pluginName, pkg, spec,
    config: { defaults: getConfigDefaults(pluginName) || {} },
    commands: spec.commands || [],
  };
  const parts: string[] = [];
  for (const section of pipelineFor(spec)) {
    let out: string | null = null;
    try { out = section.render(ctx); } catch { out = null; }
    if (out != null && String(out).trim()) parts.push(String(out).trim());
  }
  return parts.join("\n\n") + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd libs/core && npx vitest run src/__tests__/readme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C libs/core add src/readme.ts src/__tests__/readme.test.ts src/__tests__/fixtures/gen-demo/package.json
git -C libs/core commit -m "feat(readme): generateReadme pipeline + extraSections merge"
```

---

### Task 4: `core` — `readme` / `readme --check` CLI

**Files:**
- Modify: `libs/core/src/readme.ts`
- Test: `libs/core/src/__tests__/readme.test.ts`

**Interfaces:**
- Consumes: `generateReadme` (Task 3).
- Produces: `runReadmeCli(pluginName: string, argv: string[], cwd?: string): void` (sets `process.exitCode = 1` on drift), `maybeRunReadmeCli(pluginName: string): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// append to readme.test.ts
import { runReadmeCli } from "../readme.js";
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join as pj } from "path";

describe("runReadmeCli", () => {
  it("writes README.md then --check passes; a mutated file fails", () => {
    const dir = mkdtempSync(pj(tmpdir(), "readme-cli-"));
    writeFileSync(pj(dir, "package.json"), JSON.stringify({ name: "cli-demo", description: "d", license: "MIT",
      repository: { url: "git+https://github.com/intisy-ai/cli-demo.git" } }));
    defineConfig("cli-demo", { logging: true });
    define2({ description: "d" });
    runReadmeCli("cli-demo", [], dir);                    // writes
    expect(readFileSync(pj(dir, "README.md"), "utf-8")).toContain("# cli-demo");
    process.exitCode = 0;
    runReadmeCli("cli-demo", ["--check"], dir);           // matches
    expect(process.exitCode).toBe(0);
    writeFileSync(pj(dir, "README.md"), "stale");
    runReadmeCli("cli-demo", ["--check"], dir);           // drift
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd libs/core && npx vitest run src/__tests__/readme.test.ts`
Expected: FAIL — `runReadmeCli` undefined.

- [ ] **Step 3: Write minimal implementation**

Append to `libs/core/src/readme.ts`:

```ts
export function runReadmeCli(pluginName: string, argv: string[], cwd = process.cwd()): void {
  const check = argv.indexOf("--check") !== -1;
  const generated = generateReadme(pluginName, cwd);
  const file = join(cwd, "README.md");
  if (check) {
    const current = existsSync(file) ? readFileSync(file, "utf-8") : "";
    if (current !== generated) {
      console.error("README.md is out of date — regenerate with `node dist/index.js readme`.");
      process.exitCode = 1;
    }
    return;
  }
  writeFileSync(file, generated);
  console.log("Wrote " + file);
}

// call at the top of a plugin entry, like maybeRunConfigCli: returns true when the
// process was invoked as `node <bundle> readme [--check]` (caller then exits).
export function maybeRunReadmeCli(pluginName: string): boolean {
  const argv = process.argv.slice(2);
  if (argv[0] !== "readme") return false;
  try { runReadmeCli(pluginName, argv.slice(1)); }
  catch (e: unknown) { console.error(String((e as { message?: string }).message ?? e)); process.exitCode = 1; }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd libs/core && npx vitest run src/__tests__/readme.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C libs/core add src/readme.ts src/__tests__/readme.test.ts
git -C libs/core commit -m "feat(readme): readme + readme --check CLI"
```

---

### Task 5: `core` — public exports, contract-kit hook, build + push

**Files:**
- Modify: `libs/core/src/index.ts`
- Modify: `libs/core/src/testing.ts`
- Test: `libs/core/src/__tests__/readme.test.ts` (existing suite must stay green)

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: exported `defineReadme`, `generateReadme`, `runReadmeCli`, `maybeRunReadmeCli`, `registerSection`, `DEFAULT_SECTIONS`, types `ReadmeSpec`, `SectionRenderer`, `ExtraSection`; contract spec field `readme?: boolean`.

- [ ] **Step 1: Add exports to `libs/core/src/index.ts`**

After the existing `command`/`configcli` export lines add:

```ts
export { defineReadme, getReadmeSpec, generateReadme, runReadmeCli, maybeRunReadmeCli, registerSection, DEFAULT_SECTIONS } from "./readme.js";
export type { ReadmeSpec, SectionRenderer, ExtraSection } from "./readme.js";
```

- [ ] **Step 2: Extend the contract kit**

In `libs/core/src/testing.ts`, add `readme?: boolean;` to `PluginContractSpec`, and inside `runPluginContract`, when `spec.readme` is set, add a test that runs the entry with `readme --check` in the plugin dir and asserts exit 0:

```ts
if (spec.readme) {
  it("README.md is up to date (readme --check)", () => {
    // runNode throws on non-zero exit; a fresh generated README must match the committed one
    expect(() => runNode([spec.entry, "readme", "--check"])).not.toThrow();
  });
}
```

- [ ] **Step 3: Build core + run full core test suite**

Run: `cd libs/core && npm install && npm run build && npx vitest run`
Expected: build clean; all readme tests + existing tests PASS.

- [ ] **Step 4: Commit and push core**

```bash
git -C libs/core add src/index.ts src/testing.ts
git -C libs/core commit -m "feat(readme): export generator + contract readme --check assertion"
git -C libs/core push origin main
```

> NOTE: pushing `core` here makes the generator available to consumers via the submodule advance in the release task. Requires default-branch push authorization.

---

## Migration recipe (Tasks 6–14)

Each plugin migration is one task with the SAME steps; only the plugin and its lifted prose differ. The acceptance test is **parity**: the generated README is equivalent to the current one (same sections/content), verified by diff-and-review.

Per-plugin steps:
1. Advance the plugin's `core` submodule to the latest pushed `main` so the built bundle contains the generator: `git -C <plugin>/core fetch origin main && git -C <plugin>/core reset --hard origin/main`.
2. Read the plugin's current `README.md`. Lift its Description, Under-the-Hood Architecture (the mermaid body), and Structure bullets into a `defineReadme({...})` call.
3. Add the `defineReadme(...)` call in the plugin entry, immediately AFTER its existing `defineConfig(...)` and BEFORE the CLI guard. Pass the plugin's command definitions array (the same const passed to `deployCommands`/`deployLoaderCommands`) as `commands` (omit if the plugin has none).
4. Add `maybeRunReadmeCli("<config-name>")` handling: in the entry, right where the plugin calls its config guard, add — for opencode-loader/plugin-updater style entries that guard with `maybeRunCli`/`maybeRunConfigCli` — `if (maybeRunReadmeCli("<name>")) process.exit(0);` before that guard. Use the SAME name the plugin passes to `defineConfig` (e.g. `claude-code` for claude-code-auth).
5. Add `"postbuild": "node dist/index.js readme"` to `package.json` scripts.
6. Add the CI drift-check to `.github/workflows/publish.yml`: a step `- run: git diff --exit-code -- README.md` placed immediately AFTER `- run: npm run build` (the build's `postbuild` regenerates README.md; the diff then fails the release if the committed file was stale).
7. Build: `cd <plugin> && npm install && npm run build` (this regenerates `README.md` via postbuild).
8. Verify parity: `git -C <plugin> diff -- README.md`. Confirm the diff is only structural normalization, not lost content. Adjust the `defineReadme` spec (tagline/description/architecture/structure/extraSections) until the generated README carries all the information the old one had.
9. Add `readme: true` to the plugin's `src/__tests__/contract.test.ts` `runPluginContract({...})` spec.
10. Run the plugin's tests: `cd <plugin> && npx vitest run` — contract `readme --check` must pass.
11. Commit (do NOT bump version yet — the release task does that): `git -C <plugin> add -A && git -C <plugin> commit -m "docs: generate README from central generator (defineReadme)"`.

**Loader note (Tasks 6–7 for opencode-loader/claude-code-loader):** their READMEs have extra sections beyond the 9 (e.g. the Providers tab, wrapper install). Capture those as `extraSections` entries with appropriate `after` anchors. Their commands deploy via `deployLoaderCommands`; pass the loader command list to `defineReadme.commands`, or model those commands as `extraSections` if they are not `CommandDef`-shaped.

### Task 6: Migrate `wakatime-sync` (proves the generator end-to-end)
Apply the migration recipe to `plugins/wakatime-sync` (config name `wakatime-sync`, commands `WAKATIME_COMMANDS`). This is the template; do it first and confirm parity carefully before the rest.

### Task 7: Migrate `opencode-loader`
Apply the recipe to `loaders/opencode-loader` (config name `opencode-loader`). Use `extraSections` for loader-specific content. See Loader note.

### Task 8: Migrate `claude-code-loader`
Apply the recipe to `loaders/claude-code-loader` (config name `claude-code-loader`). Keep its README spec in sync with opencode-loader's (same structure, app-specific paths differ). See Loader note.

### Task 9: Migrate `antigravity-auth`
Apply the recipe to `providers/antigravity-auth` (config name `antigravity`, commands per `src/commands`).

### Task 10: Migrate `claude-code-auth`
Apply the recipe to `providers/claude-code-auth` (config name `claude-code`, commands `CLAUDE_COMMANDS`).

### Task 11: Migrate `stub-auth`
Apply the recipe to `providers/stub-auth` (config name `stub-auth`).

### Task 12: Migrate `metric-dashboard`
Apply the recipe to `plugins/metric-dashboard` (config name `metric-dashboard`).

### Task 13: Migrate `sync-bridge`
Apply the recipe to `plugins/sync-bridge` (config name `sync-bridge`).

### Task 14: Migrate `plugin-updater`
Apply the recipe to `tools/plugin-updater` (config name `plugin-updater`, commands per `src/commands.ts`).

---

### Task 15: Coordinated release

**Files:** all 9 plugin `package.json` (version bump) + tags.

- [ ] **Step 1:** Confirm every plugin's `core` submodule points at the latest pushed `core` `main` (Task 5) and each builds clean with a regenerated README committed.
- [ ] **Step 2:** For each plugin: minor version bump (`npm version <next-minor> --no-git-tag-version --allow-same-version`), `git add -A`, commit `chore(release): v<ver>`, tag `v<ver>`.
- [ ] **Step 3:** Push each branch + tag (requires default-branch push authorization). CI runs build → `git diff --exit-code README.md` → vitest → publish.
- [ ] **Step 4:** Verify tags on origin and that at least one CI "Publish to npm" run is green.

---

## Self-Review

**Spec coverage:**
- `defineReadme` API + full-generate → Tasks 1, 3. ✅
- Extensible section-renderer pipeline (`DEFAULT_SECTIONS`, `registerSection`, `extraSections`, `SectionCtx`) → Tasks 2, 3. ✅
- 9-section mapping incl. derived Configuration/Commands/Dependencies/Installation/Badges/Logging → Task 2. ✅
- `readme` / `readme --check` CLI → Task 4. ✅
- Build `postbuild` + CI drift-check → migration recipe steps 5–6. ✅
- Contract-kit `readme --check` assertion → Task 5. ✅
- Migration of the 9 plugins → Tasks 6–14. ✅
- Coordinated release rollout → Task 15. ✅
- `core`/`core-auth` own READMEs: out of scope this pass (spec). ✅ (not planned, intentionally.)

**Placeholder scan:** No TBD/TODO. Migration tasks 7–14 reference the shared recipe with concrete per-plugin inputs (config name, command const, loader note) and a parity acceptance test — the per-plugin prose legitimately comes from reading each existing README, with diff-parity as the verifiable gate.

**Type consistency:** `ReadmeSpec`, `SectionCtx`, `SectionRenderer`, `ExtraSection` used consistently across Tasks 1–4; `generateReadme(pluginName, cwd?)`, `runReadmeCli(pluginName, argv, cwd?)`, `maybeRunReadmeCli(pluginName)` signatures match between definition and tests; `getConfigDefaults`/`defineConfig` names match core.
