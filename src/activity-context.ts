// Who is running, and why. Ambient context is set once per process or bundle
// (the same place the activity emitter is wired), so an existing emit call site
// gains correct origin without changing. Cause scoping lives here too, so the
// two travel together.

import { AsyncLocalStorage } from "async_hooks";
import { randomBytes } from "crypto";
import { getAppConfigDir } from "./env.js";
import { currentAppId, appIdForHome } from "./apps.js";
import type { Cause, Origin, Target, Trace } from "./activity.types.js";

const NO_APP = "standalone";

export interface ActivityContext {
  app?: string;
  entry?: string;
  home?: string;
  target?: Target;
}

interface CauseScope {
  cause: Cause;
  traceId: string;
  parentRoot: string | null;
  rootId: string | null;
}

let CONTEXT: ActivityContext = {};

export function setActivityContext(patch: ActivityContext | null | undefined): void {
  if (!patch || typeof patch !== "object") return;
  CONTEXT = { ...CONTEXT, ...patch };
}

export function getActivityContext(): ActivityContext {
  return CONTEXT;
}

export function resetActivityContext(): void {
  CONTEXT = {};
}

let ORIGIN: Readonly<Origin> | null = null;
let ORIGIN_KEY = "";

// Auto-baseline emits far more often than hand-placed emits did, and each origin
// would otherwise re-stat the app registry and re-resolve the home. The key holds
// everything the resolution actually depends on and can change inside a live
// process, so repointing the home (a test, a wrapper) still yields a fresh origin.
function originKey(): string {
  return [CONTEXT.app || "", CONTEXT.entry || "", CONTEXT.home || "", process.env.HUB_CONFIG_DIR || "", process.env.CORE_APP || ""].join("\u0000");
}

// The app id comes from the data-driven registry, never a literal. An empty id
// means no app owns this process (a bare CLI), which is itself worth recording.
// Frozen because the same object is handed to every event this process emits.
export function buildOrigin(): Readonly<Origin> {
  const key = originKey();
  if (ORIGIN && ORIGIN_KEY === key) return ORIGIN;
  // A stated home decides the app: a host driving another component in-process for a
  // different app's home would otherwise be attributed to the host's own app (or to
  // none at all).
  const home = CONTEXT.home || getAppConfigDir();
  const app = CONTEXT.app || (CONTEXT.home ? appIdForHome(CONTEXT.home) : "") || currentAppId() || NO_APP;
  const origin: Origin = { app, home };
  if (CONTEXT.entry) origin.entry = CONTEXT.entry;
  try { origin.pid = process.pid; } catch {}
  ORIGIN = Object.freeze(origin);
  ORIGIN_KEY = key;
  return ORIGIN;
}

const SCOPES = new AsyncLocalStorage<CauseScope>();
const UNKNOWN_CAUSE: Cause = Object.freeze({ kind: "unknown" });

function newTraceId(): string {
  return randomBytes(8).toString("hex");
}

// A scope carries the cause every event inside it inherits, one trace id, and its
// own root (the id of the first event emitted directly in this scope). `rootId`
// always starts null, never inherited, so a nested scope gets its own root instead
// of reusing the parent's. `parentRoot` is what this scope's first event chains to
// before it has a root of its own: the outer scope's root (or its own parentRoot,
// for scopes nested more than one level deep).
export function withCause<T>(cause: Cause | null | undefined, fn: () => T): T {
  const parent = SCOPES.getStore() || baseScope();
  const scope: CauseScope = {
    cause: cause && cause.kind ? cause : UNKNOWN_CAUSE,
    traceId: parent ? parent.traceId : newTraceId(),
    parentRoot: parent ? (parent.rootId ?? parent.parentRoot) : null,
    rootId: null,
  };
  return SCOPES.run(scope, fn);
}

export function currentCause(): Cause {
  const scope = SCOPES.getStore() || baseScope();
  return scope ? scope.cause : UNKNOWN_CAUSE;
}

export function currentTrace(): Trace {
  const scope = SCOPES.getStore() || baseScope();
  if (!scope) return { id: newTraceId() };
  const causedBy = scope.rootId ?? scope.parentRoot;
  return causedBy ? { id: scope.traceId, causedBy } : { id: scope.traceId };
}

// The first event emitted directly in a scope becomes that scope's own root, so
// every later event in the same scope points back at it.
export function noteEmitted(eventId: string): void {
  const scope = SCOPES.getStore();
  if (scope && !scope.rootId) scope.rootId = eventId;
}

const TRACE_ENV = "HUB_ACTIVITY_TRACE";
const CAUSE_ENV = "HUB_ACTIVITY_CAUSE";
const PARENT_ENV = "HUB_ACTIVITY_PARENT";

// A cause that starts in one process usually finishes in another (a UI action
// spawning a CLI, a loader spawning a daemon). Merge these into the child's env
// so its events join the same chain instead of looking spontaneous.
export function activityEnv(): Record<string, string> {
  const scope = SCOPES.getStore() || baseScope();
  if (!scope) return {};
  const env: Record<string, string> = { [TRACE_ENV]: scope.traceId, [CAUSE_ENV]: JSON.stringify(scope.cause) };
  const parent = scope.rootId ?? scope.parentRoot;
  if (parent) env[PARENT_ENV] = parent;
  return env;
}

function seedFromEnv(): CauseScope | null {
  const traceId = process.env[TRACE_ENV];
  if (!traceId) return null;
  let cause: Cause = UNKNOWN_CAUSE;
  try { const parsed = JSON.parse(process.env[CAUSE_ENV] || ""); if (parsed && parsed.kind) cause = parsed; } catch {}
  // The inherited id is the PARENT's root, not this process's own, so it goes in
  // parentRoot: events here chain to it until this process establishes its own root.
  return { cause, traceId, parentRoot: process.env[PARENT_ENV] || null, rootId: null };
}

// A bundle that was handed a cause AFTER it loaded (a host setting the env around an
// in-process call into another bundle, which has its own module state and therefore its
// own AsyncLocalStorage) must still see it, so the env is re-read whenever it changes
// rather than only once at load.
let BASE_SCOPE = seedFromEnv();
let BASE_SCOPE_KEY = envScopeKey();

function envScopeKey(): string {
  return [process.env[TRACE_ENV] || "", process.env[CAUSE_ENV] || "", process.env[PARENT_ENV] || ""].join("\u0000");
}

function baseScope(): CauseScope | null {
  const key = envScopeKey();
  if (key !== BASE_SCOPE_KEY) {
    BASE_SCOPE = seedFromEnv();
    BASE_SCOPE_KEY = key;
  }
  return BASE_SCOPE;
}
