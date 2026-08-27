// The per-home settings every plugin shares (config/settings.json). Declared ONCE
// here, defaults and field types together, so a surface can render a new key
// without learning its name.

import { defineConfig } from "./config.js";
import { defineCapabilities } from "./capabilities.js";
import type { FieldSpec } from "./capabilities.types.js";

const GLOBAL_NAME = "settings";

/** What each ecosystem-wide setting is when a home has not changed it. */
export const GLOBAL_SETTINGS_DEFAULTS = {
  /** Whether every plugin also mirrors its log lines to stderr. */
  logConsole: false,
  /** Whether a mirrored log line is coloured per plugin. */
  logColor: true,
  /** Total activity log size a home keeps, or zero to keep everything. */
  activityMaxBytes: 0,
  /** How long a home keeps activity, in days, or zero to keep it forever. */
  activityMaxDays: 0,
  /** The lowest impact a home records and reads back. */
  activityMinImpact: "info",
};

const IMPACTS = ["debug", "info", "notice", "warning", "error"];

const RETENTION_HINT = "0 keeps history unlimited. Oldest whole segments are dropped when the log rotates.";

/** The ecosystem-wide settings and what each is when unset. */
export interface GlobalSettingsSchema {
  /** What each setting is when a home has not changed it. */
  defaults: Record<string, unknown>;
  /** The settings, as a surface renders them. */
  fields: FieldSpec[];
}

/** The ecosystem-wide settings, as a settings surface renders them. */
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

/**
 * The ecosystem-wide settings and their defaults, copied so a caller cannot mutate them.
 *
 * @returns the defaults and the fields.
 */
export function globalSettingsSchema(): GlobalSettingsSchema {
  return {
    defaults: { ...GLOBAL_SETTINGS_DEFAULTS },
    fields: GLOBAL_SETTINGS_FIELDS.map((field) => (
      field.options ? { ...field, options: field.options.map((option) => ({ ...option })) } : { ...field }
    )),
  };
}

/** Registers the ecosystem-wide settings so a surface can render and change them. */
export function registerGlobalSettings() {
  defineConfig(GLOBAL_NAME, GLOBAL_SETTINGS_DEFAULTS);
  defineCapabilities(GLOBAL_NAME, { fields: GLOBAL_SETTINGS_FIELDS });
}
