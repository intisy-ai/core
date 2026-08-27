// Typed surface for the Activity convention. The runtime (activity.ts) is

/** Who caused an activity: a person, the machinery itself, or an app acting on its own. */
export type Actor = "user" | "system" | "app";

/** How much one recorded activity matters, which is what a surface sorts, colours and filters by. */
export type Impact = "debug" | "info" | "notice" | "warning" | "error";

/** What one activity was about, when it was about one identifiable thing. */
export interface Subject {
  /** What kind of thing it is, for example a plugin or an account. */
  kind: string;
  /** Which one of that kind, when the activity names a particular one. */
  id?: string;
  /** What a reader sees instead of the id. */
  label?: string;
}

/** What set an activity in motion, which is what lets a chain of events be read back as one story. */
export type CauseKind = "user" | "startup" | "shutdown" | "schedule" | "hook" | "watch" | "api" | "cascade" | "unknown";

/** Where an activity was recorded: which app, which home, and which entry point. */
export interface Origin {
  /** The app that recorded it, or the standalone marker when no app owns the process. */
  app: string;
  /** Absolute path of the home it was recorded in. */
  home: string;
  /** Which entry point of that app, when the process states one. */
  entry?: string;
  /** The recording process, for telling two concurrent runs apart. */
  pid?: number;
}

/**
 * What an activity acted ON, when that is somewhere other than where it was recorded.
 *
 * @remarks
 * Absent for the ordinary case. A target that only repeats the origin says nothing, so it is set
 * only for a genuine cross-home or cross-app effect.
 */
export interface Target {
  /** The app acted on, when it is not the one recording. */
  app?: string;
  /** Absolute path of the home acted on, when it is not the one recording. */
  home?: string;
}

/** Why an activity happened, carried down a scope so every event inside it inherits the same one. */
export interface Cause {
  /** What set the work in motion. */
  kind: CauseKind;
  /** Where it was set in motion, for a cause a person triggered. */
  surface?: string;
  /** Anything more the cause is worth qualifying by. */
  detail?: string;
}

/** Ties one activity to the chain it belongs to, so a consequence can be read back to its cause. */
export interface Trace {
  /** Shared by every activity in one chain. */
  id: string;
  /** The activity this one follows from, absent for the first in a chain. */
  causedBy?: string;
}

/** One value that changed, kept with its key visible even when the value itself is redacted. */
export interface ValueChange {
  /** What changed, kept visible even when the values are not. */
  key: string;
  /** The old value, absent when redacted. */
  from?: unknown;
  /** The new value, absent when redacted. */
  to?: unknown;
  /** Set when the key named a secret, so neither value is carried. */
  redacted?: boolean;
}

/** What a caller hands the activity record to have one activity written down. */
export interface ActivitySpec {
  /** Dotted topic the activity belongs to. */
  topic: string;
  /** What happened, as one verb. */
  action: string;
  /** Who did it, defaulted per topic when absent. */
  actor?: Actor;
  /** How much it matters, defaulted per topic when absent. */
  impact?: Impact;
  /** What it was about. */
  subject?: Subject;
  /** Anything else worth keeping; `message` is the one field promoted into searchable text. */
  details?: Record<string, unknown>;
  /** What it acted on, when that is not where it was recorded. */
  target?: Target;
  /** Why it happened, taken from the enclosing scope when absent. */
  cause?: Cause;
  /** Whether the work succeeded, for an activity that reports one. */
  outcome?: "ok" | "failed";
  /** How long the work took, in milliseconds. */
  durationMs?: number;
  /** The values it changed, redacted on the way in. */
  changes?: ValueChange[];
}

/** One activity as it is read back, with everything the writer left implicit filled in. */
export interface ActivityRecord {
  /** Unique within the home, and the tie-breaker when two records share a millisecond. */
  id: string;
  /** When it happened, in epoch milliseconds. */
  ts: number;
  /**
   * Monotonic only within the emitting process, so two processes racing into one home can tie.
   * Absent on a record written before the field existed and still on disk in an older log.
   */
  seq?: number;
  /** Absolute path of the home it was read from. */
  home: string;
  /** Dotted topic it belongs to. */
  topic: string;
  /** What happened, as one verb. */
  action: string;
  /** Who did it. */
  actor: Actor;
  /** How much it matters. */
  impact: Impact;
  /** Who recorded it, normally a plugin id. */
  source: string;
  /** What it was about. */
  subject?: Subject;
  /** Everything the recorder attached that has no field of its own. */
  details: Record<string, unknown>;
  /** One line describing it, for a surface that renders text. */
  text: string;
  /** Where it was recorded. */
  origin: Origin;
  /** What it acted on, when that is not where it was recorded. */
  target?: Target;
  /** Why it happened. */
  cause: Cause;
  /** The chain it belongs to. */
  trace: Trace;
  /** Whether the work succeeded, for an activity that reports one. */
  outcome?: "ok" | "failed";
  /** How long the work took, in milliseconds. */
  durationMs?: number;
  /** The values it changed. */
  changes?: ValueChange[];
}

/** What retention is acting on in one home. */
export interface ActivityHomeStats {
  /** Absolute path of the home measured. */
  home: string;
  /** Total size of its retained log files. */
  bytes: number;
  /** How many log files it is holding. */
  segments: number;
  /** The oldest event still on disk, in epoch milliseconds. */
  oldestTs?: number;
}

/**
 * What retention is acting on across every home asked about.
 *
 * @remarks
 * Deliberately no record count: that would mean reading every byte of an unbounded history to
 * render a settings screen.
 */
export interface ActivityStats {
  /** The figures for each home measured. */
  homes: ActivityHomeStats[];
  /** Total size across every home. */
  bytes: number;
  /** How many log files across every home. */
  segments: number;
  /** The oldest event still on disk anywhere, in epoch milliseconds. */
  oldestTs?: number;
}

/** Which slice of the activity record a caller wants. */
export interface ActivityQuery {
  /** Keep only these impacts, which also overrides the per-home floor. */
  impacts?: Impact[];
  /** Keep only activity recorded by these sources. */
  sources?: string[];
  /** Keep only activity on these topics. */
  topics?: string[];
  /** Keep only these subjects, each a kind or a kind and id joined by a colon. */
  subjects?: string[];
  /** Keep only activity at or after this epoch millisecond. */
  since?: number;
  /** Keep only activity at or before this epoch millisecond. */
  until?: number;
  /** Keep only activity whose text or details contain this, case-insensitively. */
  search?: string;
  /** How many records one page may hold. */
  limit?: number;
  /** Opaque cursor from a previous page. */
  cursor?: string;
}
