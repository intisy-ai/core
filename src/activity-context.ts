// @ts-nocheck
// Who is running, and why. Ambient context is set once per process or bundle
// (the same place the activity emitter is wired), so an existing emit call site
// gains correct origin without changing. Cause scoping lives here too, so the
// two travel together.

import { getAppConfigDir } from "./env.js";
import { currentAppId } from "./apps.js";

const NO_APP = "standalone";

let CONTEXT = {};

export function setActivityContext(patch) {
  if (!patch || typeof patch !== "object") return;
  CONTEXT = { ...CONTEXT, ...patch };
}

export function getActivityContext() {
  return CONTEXT;
}

export function resetActivityContext() {
  CONTEXT = {};
}

// The app id comes from the data-driven registry, never a literal. An empty id
// means no app owns this process (a bare CLI), which is itself worth recording.
export function buildOrigin() {
  const app = CONTEXT.app || currentAppId() || NO_APP;
  const origin = { app, home: getAppConfigDir() };
  if (CONTEXT.entry) origin.entry = CONTEXT.entry;
  try { origin.pid = process.pid; } catch {}
  return origin;
}
