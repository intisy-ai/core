// Capability declaration types. The runtime registry lives in capabilities.ts
// (@ts-nocheck, mirroring config.ts); these are the typed shapes consumers and
// plugin authors import.

export type FieldType = "boolean" | "number" | "string" | "secret" | "select" | "multiline" | "list";

export interface FieldSpec {
  key: string;
  type: FieldType;
  label?: string;
  description?: string;
  group?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  itemType?: "string" | "number";
  placeholder?: string;
}

export interface ActionSpec {
  id: string;
  label: string;
  description?: string;
  confirm?: string;
  danger?: boolean;
  args?: FieldSpec[];
}

// A section asks the HOST's settings surface for a place of its own inside it, with
// the plugin choosing which of its declared fields and actions go there and in what
// order. Every settings surface honours the same declaration: the dashboard renders a
// card, a loader renders a group, each attributed to the plugin that declared it.
//
// `scope: "allHomes"` says the setting is not a per-home one: a surface managing
// several homes writes it to all of them rather than asking which. It exists for the
// plugin that genuinely spans homes; the default is per-home.
export interface SectionSpec {
  id: string;
  label: string;
  description?: string;
  order?: number;
  scope?: "home" | "allHomes";
  fields?: string[];
  actions?: string[];
}

// Where a plugin keeps state inside a home, for a surface offering to delete it when the
// plugin is uninstalled. Most plugins declare nothing: core's own conventions (the config
// file, the log files, the cache entries, all named after the plugin) are derived without
// asking. This is only for state a plugin writes somewhere its name does not appear.
//
// Paths are relative to the home directory. A path escaping the home, or naming something
// shared, is the plugin's own bug: it would be offering someone else's data for deletion.
export interface DataSpec {
  paths?: string[];
}

export interface CapabilitySchema {
  fields?: FieldSpec[];
  actions?: ActionSpec[];
  sections?: SectionSpec[];
  data?: DataSpec;
  screens?: ScreenSpec[];
}

// A section with its referenced specs resolved, which is what a renderer consumes.
export interface ResolvedSection extends Omit<SectionSpec, "fields" | "actions"> {
  plugin: string;
  fields: FieldSpec[];
  actions: ActionSpec[];
}

// Presentation hints every node may carry. New sizing or spacing options belong HERE rather
// than on a kind, so adding one never touches an existing kind's renderer.
export interface NodeStyle {
  width?: string;
  grow?: number;
  align?: "start" | "center" | "end";
  pad?: "none" | "tight" | "normal";
  tone?: string;
}

// `kind` is open on purpose: each surface dispatches it through a registry and skips what it
// does not know, so a plugin built against a newer host degrades instead of blanking a screen.
export interface ScreenNode {
  kind: string;
  style?: NodeStyle;
  children?: ScreenNode[];
  [prop: string]: unknown;
}

export interface Column {
  key: string;
  label?: string;
  tone?: "normal" | "muted" | "mono" | "old" | "new";
  truncate?: number;
}

export interface ItemShape {
  title: string;
  subtitle?: string;
  badge?: string;
  icon?: string;
}

// A screen asks the host for a nav entry of its own whose contents the plugin lays out. The
// plugin supplies structure and data; the host supplies every component and all styling.
// `refreshOn` names bus topic prefixes whose arrival makes the host re-read the screen's data.
export interface ScreenSpec {
  id: string;
  label: string;
  glyph?: string;
  order?: number;
  scope?: "home" | "allHomes";
  refreshOn?: string[];
  layout: ScreenNode;
  surfaces?: { tui?: ScreenNode };
}
