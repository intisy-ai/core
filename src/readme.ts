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

export interface SectionCtx {
  pluginName: string;
  pkg: Record<string, any>;
  spec: ReadmeSpec;
  config: { defaults: Record<string, unknown> };
  commands: Array<{ name: string; description?: string; argumentHint?: string }>;
}
export interface SectionRenderer { id: string; render(ctx: SectionCtx): string | null; }

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
  const pkgDeps = c.pkg.dependencies;
  const derived = (pkgDeps && typeof pkgDeps === "object") ? Object.keys(pkgDeps) : [];
  const deps = c.spec.dependencies || derived;
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
