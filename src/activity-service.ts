import { emitEvent, readActivity } from "./activity.js";
import { getActivityContext, resetActivityContext, setActivityContext } from "./activity-context.js";
import type { ActivityQuery, ActivityRecord, ActivitySpec } from "./activity.types.js";

declare module "@intisy-ai/api" {
  interface ActivityService {
    /** Records one activity. */
    emit(spec: ActivitySpec): void;
    /** Reads recorded activity, newest first. */
    read(query?: ActivityQuery): Promise<ActivityRecord[]>;
  }
}

/**
 * Presents this library's activity record as the well-known `activity` service.
 *
 * @remarks
 * Bare rather than namespaced because it is a contract, not one implementation: a host registers
 * whichever activity record it has, and a plugin asks for `"activity"` and gets whatever answered.
 *
 * `emitEvent` has no `configDir` parameter of its own: it always attributes to the ambient activity
 * context's home (falling back to the current process's app config dir). `setActivityContext` is the
 * established way to point that at a specific home before emitting, the same mechanism a host uses
 * to drive another app's home in-process. `emit` snapshots the context first and restores it in a
 * `finally`, so a process serving several homes is only repointed for the duration of this one call,
 * never left pointed at `configDir` for whatever else runs afterward.
 *
 * @param configDir - the app home whose activity is recorded and read
 */
export function createActivityService(configDir: string): import("@intisy-ai/api").ActivityService {
  return {
    emit: (spec: ActivitySpec) => {
      const previous = getActivityContext();
      setActivityContext({ home: configDir });
      try {
        emitEvent(spec);
      } finally {
        // setActivityContext only merges keys in; a plain merge of `previous` back in
        // could not remove a `home` it never had, so the context is cleared first to
        // make the restore an exact replacement rather than a merge.
        resetActivityContext();
        setActivityContext(previous);
      }
    },
    read: async (query?: ActivityQuery) => readActivity([configDir], query).records,
  };
}
