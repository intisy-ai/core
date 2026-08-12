import { emitEvent, readActivity } from "./activity.js";
import { setActivityContext } from "./activity-context.js";
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
 * to drive another app's home in-process, so calling it here is what makes `emit` land in `configDir`
 * rather than in whatever the process's own ambient home happens to be.
 *
 * @param configDir - the app home whose activity is recorded and read
 */
export function createActivityService(configDir: string): import("@intisy-ai/api").ActivityService {
  return {
    emit: (spec: ActivitySpec) => {
      setActivityContext({ home: configDir });
      emitEvent(spec);
    },
    read: async (query?: ActivityQuery) => readActivity([configDir], query).records,
  };
}
