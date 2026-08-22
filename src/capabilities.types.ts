import type { SectionSpec } from "./generated/contracts.js";

export type {
  ActionSpec,
  CapabilitySchema,
  Column,
  DataSpec,
  FieldSpec,
  FieldType,
  ItemShape,
  NodeStyle,
  ScreenNode,
  ScreenSpec,
  SectionSpec,
} from "./generated/contracts.js";

// A section with its referenced specs resolved, which is what a renderer consumes.
export interface ResolvedSection extends Omit<SectionSpec, "fields" | "actions"> {
  plugin: string;
  fields: import("./generated/contracts.js").FieldSpec[];
  actions: import("./generated/contracts.js").ActionSpec[];
}
