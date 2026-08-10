// Splitting a plugin's declaration into its contributed sections and what is left
// over. Every settings surface (the dashboard, a loader) does this the same way, so
// the rule lives here once: a field or action NAMED by a section belongs to that
// section and nowhere else, and the remainder is the plugin's own flat settings.

import type { ActionSpec, CapabilitySchema, FieldSpec, ResolvedSection } from "./capabilities.types.js";

export interface Layout {
  sections: ResolvedSection[];
  fields: FieldSpec[];
  actions: ActionSpec[];
}

function byOrderThenLabel(a: ResolvedSection, b: ResolvedSection): number {
  return (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.label.localeCompare(b.label);
}

// A section that names nothing the plugin declared is dropped: rendering an empty
// card attributed to a plugin tells the reader less than showing nothing at all.
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

export function sectionById(plugin: string, schema: CapabilitySchema, id: string): ResolvedSection | null {
  return resolveLayout(plugin, schema).sections.find((section) => section.id === id) ?? null;
}
