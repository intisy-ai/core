import { emitEvent, readActivity } from "./activity.js";
import { getActivityContext, resetActivityContext, setActivityContext } from "./activity-context.js";
import type { ActivityQuery, ActivityRecord, ActivitySpec } from "./activity.types.js";

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
 * One instance stamps everything it records with one `source`, since it cannot tell who called it.
 * A host that wants its plugins told apart in {@link ActivityQuery.sources} hands each plugin its
 * own service.
 *
 * @param configDir - the app home whose activity is recorded and read
 * @param source - what recorded activity is attributed to, normally a plugin id
 */
export function createActivityService(configDir: string, source: string): import("@intisy-ai/api").ActivityService {
  return {
    emit: (spec: ActivitySpec) => {
      const previous = getActivityContext();
      setActivityContext({ home: configDir });
      try {
        emitEvent(spec, source);
      } finally {
        // setActivityContext merges, so the context is cleared first to make the restore exact.
        resetActivityContext();
        setActivityContext(previous);
      }
    },
    read: async (query?: ActivityQuery): Promise<{ records: ActivityRecord[]; nextCursor?: string }> =>
      readActivity([configDir], query),
  };
}
