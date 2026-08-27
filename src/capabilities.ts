// Capability declaration: a plugin describes its controllable settings and actions as DATA so a
// generic dashboard can render typed control panels for it without hardcoding any plugin's features.
// This layers metadata (types, labels, groups, enums, bounds, action buttons) on top of the flat
// defaults registered via defineConfig. It writes nothing; it is purely a declaration, surfaced
// through the `config schema` CLI. Actions reference commands the plugin already exposes through
// core's command framework; this only adds their presentation.
//
// The registry and its sanitising live in Java (Capabilities, runtime/) behind CoreJs's exports.
import type { CapabilitySchema } from "./capabilities.types.js";
import { getCore } from "./core-teavm-loader.js";

// Fields dedupe by key, actions and sections by id, with the latest declaration winning. Malformed
// entries are dropped so a bad declaration never crashes app launch.
/**
 * Registers what one plugin declares, merged across calls.
 *
 * @param name the plugin declaring it.
 * @param schema the declaration; a malformed entry inside it is dropped rather than rejected.
 */
export function defineCapabilities(name: string, schema: CapabilitySchema): void {
  getCore().defineCapabilities(name, JSON.stringify(schema ?? {}));
}

// Returns only the non-empty arrays, so a plugin that never declared capabilities yields {}. Crossing
// the boundary serialises, so the caller inherently gets a copy of the registry rather than a handle
// into it.
/**
 * What one plugin declared.
 *
 * @param name the plugin to read.
 * @returns the declaration, empty when the plugin declared nothing.
 */
export function getCapabilities(name: string): CapabilitySchema {
  return JSON.parse(getCore().getCapabilities(name));
}
