// @ts-nocheck
// Who is running, and why. Ambient context is set once per process or bundle
// (the same place the activity emitter is wired), so an existing emit call site
// gains correct origin without changing. Cause scoping lives here too, so the
// two travel together.

import { AsyncLocalStorage } from "async_hooks";
import { randomBytes } from "crypto";
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

const SCOPES = new AsyncLocalStorage();
const UNKNOWN_CAUSE = Object.freeze({ kind: "unknown" });

function newTraceId() {
  return randomBytes(8).toString("hex");
}

// A scope carries the cause every event inside it inherits, one trace id, and its
// own root (the id of the first event emitted directly in this scope). `rootId`
// always starts null, never inherited, so a nested scope gets its own root instead
// of reusing the parent's. `parentRoot` is what this scope's first event chains to
// before it has a root of its own: the outer scope's root (or its own parentRoot,
// for scopes nested more than one level deep).
export function withCause(cause, fn) {
  const parent = SCOPES.getStore();
  const scope = {
    cause: cause && cause.kind ? cause : UNKNOWN_CAUSE,
    traceId: parent ? parent.traceId : newTraceId(),
    parentRoot: parent ? (parent.rootId ?? parent.parentRoot) : null,
    rootId: null,
  };
  return SCOPES.run(scope, fn);
}

export function currentCause() {
  const scope = SCOPES.getStore();
  return scope ? scope.cause : UNKNOWN_CAUSE;
}

export function currentTrace() {
  const scope = SCOPES.getStore();
  if (!scope) return { id: newTraceId() };
  const causedBy = scope.rootId ?? scope.parentRoot;
  return causedBy ? { id: scope.traceId, causedBy } : { id: scope.traceId };
}

// The first event emitted directly in a scope becomes that scope's own root, so
// every later event in the same scope points back at it.
export function noteEmitted(eventId) {
  const scope = SCOPES.getStore();
  if (scope && !scope.rootId) scope.rootId = eventId;
}
