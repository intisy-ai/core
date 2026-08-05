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

export interface CapabilitySchema {
  fields?: FieldSpec[];
  actions?: ActionSpec[];
  menu?: MenuSpec;
}
