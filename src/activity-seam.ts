// The write-side Activity seam a host app installs into a generic consumer (a
// loader's TUI capability, a plugin's own activation hook): an emitter bound to
// the caller's own source name, plus the shared cause-scope and cross-process
// trace-propagation functions. One factory instead of four copies of the same
// three-line object, one per caller, differing only in the source name they close
// over.

import { emitEvent } from "./activity.js";
import { withCause, activityEnv } from "./activity-context.js";
import type { ActivitySpec } from "./activity.types.js";

/** The narrow activity surface one plugin is handed, already bound to that plugin as the source. */
export interface ActivitySeam {
  /** Writes one activity down, attributed to this seam source. */
  emit: (spec: ActivitySpec) => void;
  /** Runs work in a scope every activity inside it inherits its cause from. */
  scope: typeof withCause;
  /** The environment a child process needs to join this cause chain. */
  env: typeof activityEnv;
}

/**
 * Binds the activity surface to one source.
 *
 * @param source who the events it records are attributed to.
 * @returns the seam that plugin uses.
 */
export function createActivitySeam(source: string): ActivitySeam {
  return {
    emit: (spec) => { try { emitEvent(spec, source); } catch { /* activity is never worth breaking a caller's action for */ } },
    scope: withCause,
    env: activityEnv,
  };
}
