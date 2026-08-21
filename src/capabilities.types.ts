import type { SectionSpec } from "@intisy-ai/core-contracts";

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
} from "@intisy-ai/core-contracts";

// A section with its referenced specs resolved, which is what a renderer consumes.
export interface ResolvedSection extends Omit<SectionSpec, "fields" | "actions"> {
  plugin: string;
  fields: import("@intisy-ai/core-contracts").FieldSpec[];
  actions: import("@intisy-ai/core-contracts").ActionSpec[];
}
