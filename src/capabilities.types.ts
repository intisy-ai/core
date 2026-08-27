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
/** One settings section with its field and action ids replaced by the things they name. */
export interface ResolvedSection extends Omit<SectionSpec, "fields" | "actions"> {
  /** The plugin this section belongs to. */
  plugin: string;
  /** The settings this section shows, in the order it shows them. */
  fields: import("./generated/contracts.js").FieldSpec[];
  /** The buttons this section offers. */
  actions: import("./generated/contracts.js").ActionSpec[];
}
