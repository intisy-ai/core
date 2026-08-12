import type { ActionResult, CapabilitySchema, SettingsCapability } from "@intisy-ai/api";
import { getCapabilities } from "./capabilities.js";

/** Runs one of a plugin's declared actions. */
export type ActionRunner = (actionId: string, input?: Record<string, unknown>) => Promise<ActionResult> | ActionResult;

/**
 * Presents what a plugin declared through `defineCapabilities` as the `settings` capability.
 *
 * @remarks
 * The declaration registry is already the plugin's own description of its settings and actions, so
 * this only hands it to the host under the capability contract. A throwing runner becomes a failed
 * {@link ActionResult}: a settings surface has a place to show a message and no place to show an
 * exception.
 *
 * @param name - the config name the plugin registered its declaration under
 * @param run - what actually performs an action
 */
export function createSettingsCapability(name: string, run: ActionRunner): SettingsCapability {
  return {
    schema: (): CapabilitySchema => getCapabilities(name),
    run: async (actionId: string, input?: Record<string, unknown>): Promise<ActionResult> => {
      try {
        return await run(actionId, input);
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
  };
}
