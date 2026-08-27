// Central README generator. A plugin registers a spec at module load via
// defineReadme(); the `readme` CLI action (below) assembles README.md from the
// spec + derived data (package.json, config defaults, commands) through an
// ordered array of section renderers, so new sections are additive.
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { getConfigDefaults } from "./config.js";
import { commandsFor } from "./plugin-declarations.js";
import type { PluginManifest } from "@intisy-ai/api";

/** The plugin settings as the configuration section renders them. */
export interface ReadmeConfig {
  /** What each setting is when a home has not changed it. */
  defaults: Record<string, unknown>;
}

/** What each directory of a repo holds, for the structure section. */
export interface ReadmeStructure {
  /** One line per source directory. */
  src?: string[];
  /** One line per build-output directory. */
  dist?: string[];
}

/** One command a README lists, for a repo with no manifest to declare it in. */
export interface ReadmeCommand {
  /** The command name. */
  name: string;
  /** One line saying what it does. */
  description?: string;
  /** Hint describing its arguments. */
  argumentHint?: string;
}

/** One section a plugin adds to the generated README beyond the standard set. */
export interface ExtraSection {
  /** What this section is addressed by when placing another after it. */
  id: string;
  /** The heading a reader sees. */
  title: string;
  /** The markdown under the heading. */
  body: string;
  /** The standard section to place this one after, or undefined to append. */
  after?: string;
}
/** What one plugin states about itself for the README generator to render. */
export interface ReadmeSpec {
  /** The title, when it should differ from the package name. */
  name?: string;
  /** The one line under the title. */
  tagline?: string;
  /** The opening paragraph. */
  description?: string;
  /** The mermaid diagram body for the architecture section, without the fences. */
  architecture?: string;
  /** What each directory holds, for the structure section. */
  structure?: ReadmeStructure;
  /** The commands to list, for a repo with no manifest to declare them in. */
  commands?: ReadmeCommand[];
  /** The first-party packages to list. */
  dependencies?: string[];
  /** Sections beyond the standard set. */
  extraSections?: ExtraSection[];
}

let README_SPEC: ReadmeSpec | null = null;
/**
 * Registers what this plugin states about itself.
 *
 * @param spec the declaration.
 * @returns the declaration as stored.
 */
export function defineReadme(spec: ReadmeSpec): ReadmeSpec { README_SPEC = spec || {}; return README_SPEC; }
/**
 * What this plugin has stated about itself.
 *
 * @returns the declaration, empty when none was registered.
 */
export function getReadmeSpec(): ReadmeSpec { return README_SPEC || {}; }

// package.json from the process working dir (the plugin root when run via npm);
// falls back to empty so the generator never throws on a missing/broken file.
/**
 * Reads the package manifest a README describes.
 *
 * @param cwd the repo to read from.
 * @returns the parsed package.json, empty when there is none.
 */
export function loadPkg(cwd = process.cwd()): Record<string, unknown> {
  try { return JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8")); } catch { return {}; }
}

/**
 * What a repo's own manifest declares, for the sections derived from it rather than restated.
 *
 * @remarks
 * Read from the repo rather than from a running plugin, so the README says what the manifest says
 * and the two cannot drift. A repo with no manifest simply contributes nothing.
 */
export function loadManifest(cwd = process.cwd()): PluginManifest | null {
  try { return JSON.parse(readFileSync(join(cwd, "plugin.json"), "utf-8")) as PluginManifest; } catch { return null; }
}

/** Everything a section renderer is given about the repo it is rendering for. */
export interface SectionCtx {
  /** The plugin the README is for. */
  pluginName: string;
  /** The repo package manifest. */
  pkg: Record<string, any>;
  /** What the plugin stated about itself. */
  spec: ReadmeSpec;
  /** The plugin settings and their defaults, for the configuration section. */
  config: ReadmeConfig;
  /** The commands to list, whether the manifest or the spec named them. */
  commands: ReadmeCommand[];
}
/** One named section of the generated README, which may decline to render. */
export interface SectionRenderer {
  /** What this section is addressed by when placing another after it. */
  id: string;
  /**
   * Renders this section.
   *
   * @param ctx everything known about the repo being rendered for.
   * @returns the markdown, or null to omit the section entirely.
   */
  render(ctx: SectionCtx): string | null;
}

// repo "owner/name" from package.json repository.url (git+https…/….git)
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
  const path = "`<configDir>/config/" + (c.pluginName || c.pkg.name) + ".json`";
  const rows = keys.map((k) => "| `" + k + "` | `" + JSON.stringify(defaults[k]) + "` |").join("\n");
  // No per-plugin config command to point at: whether an app offers a settings command, and what
  // it is called, is the host's business and a plugin knows nothing about it.
  return ["## Configuration", "", "Config file: " + path + " (edit it directly, or through whatever settings surface the app offers).",
          "", helpers.jsonExample(defaults), "", "| Key | Default |", "| --- | --- |", rows].join("\n");
}
function renderCommands(c: SectionCtx): string | null {
  if (!c.commands || !c.commands.length) return null;
  const rows = c.commands.map((cmd) =>
    "| `/" + cmd.name + "` | " + (cmd.description || "") + " | " + (cmd.argumentHint ? "`" + cmd.argumentHint + "`" : "") + " |").join("\n");
  return ["## Commands", "", "| Command | Description | Arguments |", "| --- | --- | --- |", rows].join("\n");
}
function renderDeps(c: SectionCtx): string | null {
  const pkgDeps = c.pkg.dependencies;
  const derived = (pkgDeps && typeof pkgDeps === "object") ? Object.keys(pkgDeps) : [];
  const deps = c.spec.dependencies || derived;
  if (!deps.length) return null;
  return ["## Dependencies", "", ...deps.map((d) => "- `" + d + "`")].join("\n");
}

/** The standard sections, in the order the README standard requires them. */
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
/**
 * Adds a section to the generated README.
 *
 * @param renderer the section to add.
 * @param afterId the section to place it after, or undefined to append.
 */
export function registerSection(renderer: SectionRenderer, afterId?: string): void {
  if (DEFAULT_SECTIONS.some((s) => s.id === renderer.id)) {
    console.warn(`readme: section "${renderer.id}" already registered - ignoring duplicate.`);
    return;
  }
  const idx = afterId ? DEFAULT_SECTIONS.findIndex((s) => s.id === afterId) : -1;
  if (idx >= 0) DEFAULT_SECTIONS.splice(idx + 1, 0, renderer);
  else DEFAULT_SECTIONS.push(renderer);
}

function extraRenderer(e: ExtraSection): SectionRenderer {
  return { id: e.id, render: () => "## " + e.title + "\n\n" + e.body };
}
// merge extraSections into a copy of the default pipeline at their `after` anchors
function pipelineFor(spec: ReadmeSpec): SectionRenderer[] {
  const list = DEFAULT_SECTIONS.slice();
  for (const e of spec.extraSections || []) {
    // an extraSection whose id collides with a standard section (or a prior extra)
    // would be silently dropped; warn loudly so lost content is visible, not silent
    if (list.some((s) => s.id === e.id)) {
      console.warn(`readme: extraSection "${e.id}" collides with an existing section id - dropped. Use a unique id.`);
      continue;
    }
    const idx = e.after ? list.findIndex((s) => s.id === e.after) : list.length - 2;
    const at = idx >= 0 ? idx + 1 : list.length - 1;   // default: just before License
    list.splice(at, 0, extraRenderer(e));
  }
  return list;
}

/**
 * Renders the whole README for one repo.
 *
 * @param pluginName the plugin the README is for.
 * @param cwd the repo to read the manifest and package from.
 * @returns the rendered markdown.
 */
export function generateReadme(pluginName: string, cwd = process.cwd()): string {
  const pkg = loadPkg(cwd);
  const spec = getReadmeSpec();
  const manifest = loadManifest(cwd);
  // The manifest is the one source for both, so a spec states them only where a repo has no
  // manifest to declare them in.
  // What the HOST deploys, not only what the manifest lists: a plugin shipping settings also gets
  // a generated command to edit them, and a README that omitted it would describe a smaller surface
  // than the one a user actually has.
  const declaredCommands = manifest?.id ? commandsFor(manifest) : null;
  const declaredDefaults = manifest?.config?.defaults;
  const ctx: SectionCtx = {
    pluginName, pkg, spec,
    config: { defaults: declaredDefaults ?? getConfigDefaults(pluginName) ?? {} },
    commands: declaredCommands ?? spec.commands ?? [],
  };
  const parts: string[] = [];
  for (const section of pipelineFor(spec)) {
    let out: string | null = null;
    try { out = section.render(ctx); } catch { out = null; }
    if (out != null && String(out).trim()) parts.push(String(out).trim());
  }
  return parts.join("\n\n") + "\n";
}

/**
 * Runs the README generator as a command.
 *
 * @param pluginName the plugin the README is for.
 * @param argv the command arguments.
 * @param cwd the repo to generate in.
 */
export function runReadmeCli(pluginName: string, argv: string[], cwd = process.cwd()): void {
  const check = argv.indexOf("--check") !== -1;
  const generated = generateReadme(pluginName, cwd);
  const file = join(cwd, "README.md");
  if (check) {
    const current = existsSync(file) ? readFileSync(file, "utf-8") : "";
    if (current !== generated) {
      console.error("README.md is out of date - regenerate with `node dist/index.js readme`.");
      process.exitCode = 1;
    }
    return;
  }
  writeFileSync(file, generated);
  console.log("Wrote " + file);
}

// call at the top of a plugin entry, like maybeRunConfigCli: returns true when the
// process was invoked as `node <bundle> readme [--check]` (caller then exits).
/**
 * Runs the README generator when this process was started to do that and nothing else.
 *
 * @param pluginName the plugin the README is for.
 * @returns true when it ran, so the caller stops rather than continuing to load.
 */
export function maybeRunReadmeCli(pluginName: string): boolean {
  const argv = process.argv.slice(2);
  if (argv[0] !== "readme") return false;
  try { runReadmeCli(pluginName, argv.slice(1)); }
  catch (e: unknown) { console.error(String((e as { message?: string }).message ?? e)); process.exitCode = 1; }
  return true;
}
