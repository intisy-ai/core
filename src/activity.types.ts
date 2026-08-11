// Typed surface for the Activity convention. The runtime (activity.ts) is
// @ts-nocheck; these types are advisory, mirroring the bus.ts/bus.types.ts split.

export type Actor = "user" | "system" | "app";

export type Impact = "debug" | "info" | "notice" | "warning" | "error";

export interface Subject {
  kind: string;
  id?: string;
  label?: string;
}

export type CauseKind = "user" | "startup" | "schedule" | "hook" | "watch" | "api" | "cascade" | "unknown";

export interface Origin {
  app: string;
  home: string;
  entry?: string;
  pid?: number;
}

export interface Target {
  app?: string;
  home?: string;
}

export interface Cause {
  kind: CauseKind;
  surface?: string;
  detail?: string;
}

export interface Trace {
  id: string;
  causedBy?: string;
}

export interface ValueChange {
  key: string;
  from?: unknown;
  to?: unknown;
  redacted?: boolean;
}

export interface ActivitySpec {
  topic: string;
  action: string;
  actor?: Actor;
  impact?: Impact;
  subject?: Subject;
  details?: Record<string, unknown>;
  target?: Target;
  cause?: Cause;
  outcome?: "ok" | "failed";
  durationMs?: number;
  changes?: ValueChange[];
}

export interface ActivityRecord {
  id: string;
  ts: number;
  // Absent on a record read back from an envelope written before seq existed.
  // Monotonic only within the process that emitted it, not globally unique across
  // processes sharing the same home.
  seq?: number;
  home: string;
  topic: string;
  action: string;
  actor: Actor;
  impact: Impact;
  source: string;
  subject?: Subject;
  details: Record<string, unknown>;
  text: string;
  origin: Origin;
  target?: Target;
  cause: Cause;
  trace: Trace;
  outcome?: "ok" | "failed";
  durationMs?: number;
  changes?: ValueChange[];
}

export interface ActivityHomeStats {
  home: string;
  bytes: number;
  segments: number;
  oldestTs?: number;
}

export interface ActivityStats {
  homes: ActivityHomeStats[];
  bytes: number;
  segments: number;
  oldestTs?: number;
}

export interface ActivityQuery {
  impacts?: Impact[];
  sources?: string[];
  topics?: string[];
  subjects?: string[];
  since?: number;
  until?: number;
  search?: string;
  limit?: number;
  cursor?: string;
}
