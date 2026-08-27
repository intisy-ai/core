// The per-home settings every plugin shares (config/settings.json). Declared ONCE
// here, defaults and field types together, so a surface can render a new key
// without learning its name.

import { defineConfig } from "./config.js";
import { defineCapabilities } from "./capabilities.js";
import type { FieldSpec } from "./capabilities.types.js";

const GLOBAL_NAME = "settings";

export const GLOBAL_SETTINGS_DEFAULTS = {
  logConsole: false,
  logColor: true,
  activityMaxBytes: 0,
  activityMaxDays: 0,
  activityMinImpact: "info",
};

const IMPACTS = ["debug", "info", "notice", "warning", "error"];

const RETENTION_HINT = "0 keeps history unlimited. Oldest whole segments are dropped when the log rotates.";

export const GLOBAL_SETTINGS_FIELDS: FieldSpec[] = [
  { key: "logConsole", type: "boolean", label: "Mirror logs to the console", group: "Logging" },
  { key: "logColor", type: "boolean", label: "Color mirrored logs", group: "Logging" },
  {
    key: "activityMinImpact",
    type: "select",
    label: "Record activity from",
    description: "Events below this level are not recorded. Lower it to debug only while investigating.",
    group: "Activity",
    options: IMPACTS.map((value) => ({ value, label: value })),
  },
  {
    key: "activityMaxBytes",
    type: "number",
    label: "Keep at most (bytes)",
    description: RETENTION_HINT,
    group: "Activity",
    min: 0,
  },
  {
    key: "activityMaxDays",
    type: "number",
    label: "Keep at most (days)",
    description: RETENTION_HINT,
    group: "Activity",
    min: 0,
  },
];

export function globalSettingsSchema(): { defaults: Record<string, unknown>; fields: FieldSpec[] } {
  return {
    defaults: { ...GLOBAL_SETTINGS_DEFAULTS },
    fields: GLOBAL_SETTINGS_FIELDS.map((field) => (
      field.options ? { ...field, options: field.options.map((option) => ({ ...option })) } : { ...field }
    )),
  };
}

export function registerGlobalSettings() {
  defineConfig(GLOBAL_NAME, GLOBAL_SETTINGS_DEFAULTS);
  defineCapabilities(GLOBAL_NAME, { fields: GLOBAL_SETTINGS_FIELDS });
}
