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
}

// A menu asks the dashboard for a nav entry of its own, whose screen shows this
// plugin's fields and actions. The plugin supplies the presentation (label, glyph,
// where it sorts); the dashboard supplies the rendering.
export interface MenuSpec {
  label: string;
  glyph?: string;
  order?: number;
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
  menu?: MenuSpec;
  sections?: SectionSpec[];
  data?: DataSpec;
}

// A section with its referenced specs resolved, which is what a renderer consumes.
export interface ResolvedSection extends Omit<SectionSpec, "fields" | "actions"> {
  plugin: string;
  fields: FieldSpec[];
  actions: ActionSpec[];
}
