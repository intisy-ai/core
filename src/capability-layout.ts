// Splitting a plugin's declaration into its contributed sections and what is left
// over. Every settings surface (the dashboard, a loader) does this the same way, so
// the rule lives here once: a field or action NAMED by a section belongs to that
// section and nowhere else, and the remainder is the plugin's own flat settings.

import { byOrderThenLabel } from "./contribution-order.js";
import type { ActionSpec, CapabilitySchema, FieldSpec, ResolvedSection } from "./capabilities.types.js";

/** One plugin declaration arranged into the sections a surface renders, ids already resolved. */
export interface Layout {
  /** The sections, each carrying the things its ids named. */
  sections: ResolvedSection[];
  /** Every declared setting, including any no section filed. */
  fields: FieldSpec[];
  /** Every declared button, including any no section filed. */
  actions: ActionSpec[];
}

// A section that names nothing the plugin declared is dropped: rendering an empty
// card attributed to a plugin tells the reader less than showing nothing at all.
/**
 * Arranges a declaration into sections, placing anything the plugin did not file itself.
 *
 * @param plugin the plugin the declaration belongs to.
 * @param schema what it declared.
 * @returns the resolved layout.
 */
export function resolveLayout(plugin: string, schema: CapabilitySchema): Layout {
  const declaredFields = schema.fields ?? [];
  const declaredActions = schema.actions ?? [];
  const fieldByKey = new Map(declaredFields.map((field) => [field.key, field]));
  const actionById = new Map(declaredActions.map((action) => [action.id, action]));
  const claimedFields = new Set<string>();
  const claimedActions = new Set<string>();
  const sections: ResolvedSection[] = [];

  for (const spec of schema.sections ?? []) {
    const fields: FieldSpec[] = [];
    const actions: ActionSpec[] = [];
    for (const key of spec.fields ?? []) {
      const field = fieldByKey.get(key);
      if (field && !claimedFields.has(key)) { fields.push(field); claimedFields.add(key); }
    }
    for (const id of spec.actions ?? []) {
      const action = actionById.get(id);
      if (action && !claimedActions.has(id)) { actions.push(action); claimedActions.add(id); }
    }
    if (!fields.length && !actions.length) continue;
    const { fields: _keys, actions: _ids, ...rest } = spec;
    sections.push({ ...rest, plugin, fields, actions });
  }

  return {
    sections: sections.sort(byOrderThenLabel),
    fields: declaredFields.filter((field) => !claimedFields.has(field.key)),
    actions: declaredActions.filter((action) => !claimedActions.has(action.id)),
  };
}

/**
 * One resolved section of a declaration.
 *
 * @param plugin the plugin the declaration belongs to.
 * @param schema what it declared.
 * @param id the section wanted.
 * @returns the section, or null when the declaration has no such one.
 */
export function sectionById(plugin: string, schema: CapabilitySchema, id: string): ResolvedSection | null {
  return resolveLayout(plugin, schema).sections.find((section) => section.id === id) ?? null;
}
