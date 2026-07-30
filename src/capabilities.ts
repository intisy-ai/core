// @ts-nocheck
// Capability declaration: a plugin describes its controllable settings and
// actions as DATA so a generic dashboard can render typed control panels for it
// without hardcoding any plugin's features. This layers metadata (types, labels,
// groups, enums, bounds, action buttons) on top of the flat defaults registered
// via defineConfig. It writes nothing; it is purely a declaration, surfaced
// through the `config schema` CLI. Actions reference commands the plugin already
// exposes through core's command framework; this only adds their presentation.

import type { CapabilitySchema } from "./capabilities.types.js";

const FIELD_TYPES = new Set(["boolean", "number", "string", "secret", "select", "multiline", "list"]);

const CAPABILITIES: Record<string, { fields: unknown[]; actions: unknown[] }> = {};

function sanitizeField(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.key !== "string" || !raw.key) return null;
  if (typeof raw.type !== "string" || !FIELD_TYPES.has(raw.type)) return null;
  const field = { key: raw.key, type: raw.type };
  for (const k of ["label", "description", "group", "placeholder", "itemType"]) {
    if (typeof raw[k] === "string") field[k] = raw[k];
  }
  for (const k of ["min", "max", "step"]) {
    if (typeof raw[k] === "number") field[k] = raw[k];
  }
  if (Array.isArray(raw.options)) {
    field.options = raw.options
      .filter((o) => o && typeof o.value === "string" && typeof o.label === "string")
      .map((o) => ({ value: o.value, label: o.label }));
  }
  return field;
}

function sanitizeAction(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (typeof raw.label !== "string" || !raw.label) return null;
  const action = { id: raw.id, label: raw.label };
  if (typeof raw.description === "string") action.description = raw.description;
  if (typeof raw.confirm === "string") action.confirm = raw.confirm;
  if (raw.danger === true) action.danger = true;
  return action;
}

// Register a plugin's capability schema (merged across calls). Fields dedupe by
// key, actions dedupe by id, with the latest declaration winning. Malformed
// entries are dropped so a bad declaration never crashes app launch.
export function defineCapabilities(name: string, schema: CapabilitySchema): void {
  const store = CAPABILITIES[name] ?? (CAPABILITIES[name] = { fields: [], actions: [] });
  if (schema && Array.isArray(schema.fields)) {
    for (const raw of schema.fields) {
      const field = sanitizeField(raw);
      if (!field) continue;
      const i = store.fields.findIndex((f) => f.key === field.key);
      if (i >= 0) store.fields[i] = field;
      else store.fields.push(field);
    }
  }
  if (schema && Array.isArray(schema.actions)) {
    for (const raw of schema.actions) {
      const action = sanitizeAction(raw);
      if (!action) continue;
      const i = store.actions.findIndex((a) => a.id === action.id);
      if (i >= 0) store.actions[i] = action;
      else store.actions.push(action);
    }
  }
}

// Read back what a plugin declared. Returns only the non-empty arrays, so a
// plugin that never declared capabilities yields {} (byte-identical CLI output).
export function getCapabilities(name: string): CapabilitySchema {
  const store = CAPABILITIES[name];
  if (!store) return {};
  const out = {};
  if (store.fields.length) out.fields = store.fields.map((f) => ({ ...f }));
  if (store.actions.length) out.actions = store.actions.map((a) => ({ ...a }));
  return out;
}
