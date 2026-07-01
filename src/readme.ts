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
