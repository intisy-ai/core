import type { SectionSpec } from "@intisy-ai/api";

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
} from "@intisy-ai/api";

// A section with its referenced specs resolved, which is what a renderer consumes.
export interface ResolvedSection extends Omit<SectionSpec, "fields" | "actions"> {
  plugin: string;
  fields: import("@intisy-ai/api").FieldSpec[];
  actions: import("@intisy-ai/api").ActionSpec[];
}
