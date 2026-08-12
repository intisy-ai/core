import type { CapabilitySchema as ApiCapabilitySchema, ScreenSpec, SectionSpec } from "@intisy-ai/api";

export type {
  ActionSpec,
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

// `screens` is not part of api's settings capability, where screens are a capability of their own.
// This surface still carries them on the config-schema probe.
export interface CapabilitySchema extends ApiCapabilitySchema {
  screens?: ScreenSpec[];
}

// A section with its referenced specs resolved, which is what a renderer consumes.
export interface ResolvedSection extends Omit<SectionSpec, "fields" | "actions"> {
  plugin: string;
  fields: import("@intisy-ai/api").FieldSpec[];
  actions: import("@intisy-ai/api").ActionSpec[];
}
