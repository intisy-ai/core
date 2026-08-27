// The Activity convention: a thin, normalized layer over the event bus. emitEvent
// wraps publish() with a standardized { action, actor, impact, subject, details }
// payload; a registerable registry supplies per-topic defaults (for back-compat with
// raw publishers) and human-readable render templates. Every consumer (a dashboard, a
// loader TUI, anything else) renders through renderActivity, so activity stays readable
// without depending on any particular consumer being installed or running. All
// operations are best-effort and never throw (they inherit bus guarantees).

import { existsSync, readFileSync } from "fs";
import { publish, parseEnvelopeText, segmentPathsNewestFirst, TOPICS } from "./bus.js";
import { setErrorActivityHook, envTruthy, globalSetting } from "./log.js";
import { setConfigChangeHook } from "./config.js";
import { buildOrigin, getActivityContext, currentCause, currentTrace, noteEmitted } from "./activity-context.js";
import { redactChanges, redactMessage } from "./activity-redact.js";
import type { EventEnvelope } from "./bus.types.js";
import type { Actor, ActivityQuery, ActivityRecord, ActivitySpec, Impact } from "./activity.types.js";

const DEFAULT_ACTOR: Actor = "system";
const DEFAULT_IMPACT: Impact = "info";

const IMPACT_ORDER: Record<string, number> = { debug: 0, info: 1, notice: 2, warning: 3, error: 4 };

/** An activity record before {@link renderActivity} has given it its text. */
export type UnrenderedRecord = Omit<ActivityRecord, "text">;

/** One page of read-back activity, with the cursor the next call takes. */
export interface ActivityReadPage {
  /** The records, newest first. */
  records: ActivityRecord[];
  /** The cursor to resume from, absent on the last page. */
  nextCursor?: string;
}

/** Just enough of a record to place it in the total order pagination depends on. */
interface RecordOrder {
  ts: number;
  seq?: number;
  id: string;
}

/** What one topic contributes: its defaults, and how its actions render as text. */
export interface TopicRegistration {
  /** The impact an activity on this topic takes when it states none. */
  defaultImpact?: Impact;
  /** The actor an activity on this topic takes when it states none. */
  defaultActor?: Actor;
  /** One renderer per action, plus an optional star entry for the rest. */
  renderers: Record<string, (record: UnrenderedRecord) => string>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

// Universal auto-coverage would otherwise let chatty debug events crowd out the ones
// worth reading, so the floor is configurable per home and defaults above debug.
// The floor is a per-home setting, so it must be read from the home the record is
// actually about to land in (the resolved origin), never the ambient process home.
function meetsImpactFloor(impact: string, home: string): boolean {
  const floor = IMPACT_ORDER[String(globalSetting("activityMinImpact", "info", home))] ?? IMPACT_ORDER.info;
  return (IMPACT_ORDER[impact] ?? IMPACT_ORDER.info) >= floor;
}

const REGISTRY = new Map<string, TopicRegistration>();

/**
 * Registers what one topic defaults to and how its actions render as text.
 *
 * @param topic the topic to register.
 * @param def the defaults and renderers, merged over anything already registered.
 */
export function registerActivity(topic: string, def: Partial<TopicRegistration> = {}): void {
  const existing: TopicRegistration = REGISTRY.get(topic) || { renderers: {} };
  REGISTRY.set(topic, {
    defaultImpact: def.defaultImpact ?? existing.defaultImpact,
    defaultActor: def.defaultActor ?? existing.defaultActor,
    renderers: { ...existing.renderers, ...(def.renderers || {}) },
  });
}

function topicDefaults(topic: string): Partial<TopicRegistration> {
  return REGISTRY.get(topic) || {};
}

const LEVEL_TO_IMPACT: Record<string, Impact> = { info: "info", success: "notice", warning: "warning", error: "error" };

// A suite that logs an error would otherwise write a bus event into whatever home
// the process points at. Tests turn emission off; nothing else should.
let ENABLED = !envTruthy(process.env.CORE_ACTIVITY_OFF);

/**
 * Switches emission on or off for this process.
 *
 * @param on whether activity is recorded.
 * @remarks
 * A test suite turns this off so a logged error does not write into whatever home the process
 * happens to point at. Nothing else should.
 */
export function setActivityEnabled(on: boolean): void {
  ENABLED = !!on;
}

// details.message is the one free-text field a caller can put anything into, and
// renderActivity promotes it into the searchable text, so a credential interpolated
// into it would outlive the operation. Nothing else in details is free text.
/**
 * Removes any credential from the one free-text field a caller can put anything into.
 *
 * @param details whatever the caller attached.
 * @returns the details with `message` redacted, empty when there were none.
 */
export function redactDetails(details: unknown): Record<string, unknown> {
  const record = asRecord(details);
  if (typeof record.message !== "string") return record;
  return { ...record, message: redactMessage(record.message) };
}

/**
 * Writes one activity down, if this process records activity and the impact clears the floor.
 *
 * @param spec what happened.
 * @param source who is recording it.
 * @returns the appended envelope, or null when nothing was written.
 */
export function emitEvent(spec: ActivitySpec, source = "core"): EventEnvelope | null {
  if (!ENABLED) return null;
  const d = topicDefaults(spec.topic);
  const impact = spec.impact ?? d.defaultImpact ?? DEFAULT_IMPACT;
  const origin = buildOrigin();
  if (!meetsImpactFloor(impact, origin.home)) return null;
  const ctx = getActivityContext();
  const target = spec.target ?? ctx.target;
  const payload: Record<string, unknown> = {
    action: spec.action,
    actor: spec.actor ?? d.defaultActor ?? DEFAULT_ACTOR,
    impact,
    subject: spec.subject,
    origin,
    cause: spec.cause ?? currentCause(),
    trace: currentTrace(),
    details: redactDetails(spec.details),
  };
  // A target that only repeats the origin's home says nothing, so callers can pass
  // one unconditionally and only a real cross-home or cross-app effect is recorded.
  if (target && (target.app || (target.home && target.home !== origin.home))) payload.target = target;
  if (spec.outcome) payload.outcome = spec.outcome;
  if (typeof spec.durationMs === "number") payload.durationMs = spec.durationMs;
  if (spec.changes) payload.changes = redactChanges(spec.changes);
  const envelope = publish(spec.topic, payload, source, origin.home);
  if (envelope) noteEmitted(envelope.id);
  return envelope;
}

/**
 * Reads one envelope back as a whole activity record, filling in what the writer left implicit.
 *
 * @param envelope the stored event.
 * @param home the app home it was read from.
 * @returns the record, including its rendered text.
 */
export function normalizeActivity(envelope: EventEnvelope, home = ""): ActivityRecord {
  const p = asRecord(envelope.payload);
  const d = topicDefaults(envelope.topic);
  const hasActivity = typeof p.action === "string";
  const action = hasActivity ? (p.action as string) : impliedAction(envelope.topic, p);
  const impact = (p.impact as Impact | undefined)
    ?? (typeof p.level === "string" ? LEVEL_TO_IMPACT[p.level] : undefined)
    ?? d.defaultImpact ?? DEFAULT_IMPACT;
  const actor = (p.actor as Actor | undefined) ?? d.defaultActor ?? DEFAULT_ACTOR;
  const rec: UnrenderedRecord = {
    id: envelope.id,
    ts: envelope.ts,
    seq: envelope.seq,
    home,
    topic: envelope.topic,
    action,
    actor,
    impact,
    source: envelope.source,
    subject: p.subject as ActivityRecord["subject"],
    origin: (p.origin as ActivityRecord["origin"]) ?? { app: "", home },
    target: p.target as ActivityRecord["target"],
    cause: (p.cause as ActivityRecord["cause"]) ?? { kind: "unknown" },
    trace: (p.trace as ActivityRecord["trace"]) ?? { id: envelope.id },
    outcome: p.outcome as ActivityRecord["outcome"],
    durationMs: p.durationMs as number | undefined,
    changes: p.changes as ActivityRecord["changes"],
    details: hasActivity ? asRecord(p.details) : stripKnown(p),
  };
  return { ...rec, text: renderActivity(rec) };
}

// A raw (pre-emitEvent) publisher has no action; infer a stable verb from the topic
// so old events still render. Keeps back-compat without an envelope-version bump.
function impliedAction(topic: string, payload: Record<string, unknown>): string {
  if (topic === TOPICS.notification) return "notified";
  if (topic === TOPICS.proxyStatus) return payload.up ? "started" : "stopped";
  if (topic === TOPICS.accountRateLimited) return "rate_limited";
  if (topic === TOPICS.configChanged) return "config_changed";
  if (topic === TOPICS.pluginInstalled) return "installed";
  return topic.replace(/[.]/g, "_");
}

function stripKnown(payload: Record<string, unknown>): Record<string, unknown> {
  const { action, actor, impact, subject, origin, target, cause, trace, outcome, durationMs, changes, ...rest } = payload;
  return rest;
}

/**
 * One line describing an activity, for a surface that renders text.
 *
 * @param rec the record to describe.
 * @returns the topic renderer output, else a caller-supplied message, else a generic line.
 */
export function renderActivity(rec: UnrenderedRecord): string {
  const d = topicDefaults(rec.topic);
  const fn = d.renderers?.[rec.action] || d.renderers?.["*"];
  if (fn) { try { return fn(rec); } catch { /* fall through to generic */ } }
  // Universal coverage means most events come from topics this process never
  // registered a renderer for, so a caller-supplied message is the best text there is.
  const message = rec.details?.message;
  if (typeof message === "string" && message) return message;
  const label = rec.subject?.label || rec.subject?.id || "";
  return `${rec.source} ${rec.action}${label ? " " + label : ""}`.trim();
}

// Renderer helpers. Every one works off caller-supplied data only, so core still names
// no app, plugin, or vendor.
function subjectOf(rec: UnrenderedRecord): string {
  return String(rec.subject?.label || rec.subject?.id || rec.details?.name || "it");
}

function shortHash(hash: unknown): string {
  const text = String(hash);
  return text.length > 8 ? text.slice(0, 8) : text;
}

function versionLine(prefix: string, from: unknown, to: unknown): string {
  const a = from ? shortHash(from) : "";
  const b = to ? shortHash(to) : "";
  if (a && b) return `${prefix} ${a} to ${b}`;
  if (b) return `${prefix} to ${b}`;
  return prefix;
}

function countLine(prefix: string, first: unknown, firstNoun: string, second: unknown, secondNoun: string): string {
  const parts: string[] = [];
  const firstCount = Array.isArray(first) ? first.length : Number(first) || 0;
  const secondCount = Array.isArray(second) ? second.length : Number(second) || 0;
  if (firstCount) parts.push(`${firstCount} ${firstNoun}${firstCount === 1 ? "" : "s"}`);
  if (secondCount) parts.push(`${secondCount} ${secondNoun}${secondCount === 1 ? "" : "s"}`);
  return parts.length ? `${prefix} ${parts.join(" and ")}` : `${prefix} nothing`;
}

registerBuiltins();

function registerBuiltins(): void {
  registerActivity(TOPICS.notification, { defaultImpact: "info", defaultActor: "system",
    renderers: { notified: (r) => String(r.details?.message ?? "notification") } });
  registerActivity(TOPICS.proxyStatus, { defaultImpact: "notice", defaultActor: "system",
    renderers: { started: () => "Proxy started", stopped: () => "Proxy stopped" } });
  registerActivity(TOPICS.accountRateLimited, { defaultImpact: "warning", defaultActor: "system",
    renderers: { rate_limited: (r) => `${r.subject?.label || r.subject?.id || "account"} rate-limited` } });
  registerActivity(TOPICS.configChanged, { defaultImpact: "notice", defaultActor: "user",
    renderers: { config_changed: (r) => `Config changed: ${r.subject?.id || r.details?.name || ""}` } });
  registerActivity(TOPICS.pluginInstalled, { defaultImpact: "notice", defaultActor: "system",
    renderers: {
      installed: (r) => `Installed ${subjectOf(r)} ${r.details?.version || ""}`.trim(),
      updated: (r) => versionLine(`Updated ${subjectOf(r)}`, r.details?.fromVersion, r.details?.toVersion),
      update_available: (r) => versionLine(`Update available for ${subjectOf(r)}`, r.details?.fromVersion, r.details?.toVersion),
      update_failed: (r) => `Could not update ${subjectOf(r)}${r.details?.message ? ": " + r.details.message : ""}`,
      uninstalled: (r) => `Uninstalled ${subjectOf(r)}`,
      downgraded: (r) => `Rolled ${subjectOf(r)} back${r.details?.hash ? " to " + shortHash(r.details.hash) : ""}`,
    } });
  registerActivity(TOPICS.syncCompleted, { defaultImpact: "notice", defaultActor: "system",
    renderers: { sync_completed: (r) => countLine("Synced", r.details?.files, "file", r.details?.plugins, "plugin") } });
  registerActivity("account", { defaultImpact: "info", defaultActor: "user",
    renderers: {
      login_succeeded: (r) => `Signed in ${subjectOf(r)}`,
      login_failed: (r) => `Sign-in failed for ${r.details?.provider || "a provider"}${r.details?.message ? ": " + r.details.message : ""}`,
      account_added: (r) => `Added account ${subjectOf(r)}`,
      account_updated: (r) => `Updated account ${subjectOf(r)}`,
      account_removed: (r) => `Removed account ${subjectOf(r)}`,
      models_refreshed: (r) => countLine(`Refreshed models for ${subjectOf(r)}:`, r.details?.count, "model", 0, ""),
    } });
  registerActivity(TOPICS.commandInvoked, { defaultImpact: "debug", defaultActor: "user",
    renderers: { invoked: (r) => `Ran ${r.subject?.label || r.subject?.id || "a command"}` } });
  registerActivity(TOPICS.pluginActivated, { defaultImpact: "info", defaultActor: "app",
    renderers: { activated: (r) => `${r.subject?.label || r.subject?.id || "plugin"} activated` } });
  // Progress is a transient signal about work in flight, not a fact worth keeping: at
  // debug it stays out of the way unless someone lowers the floor to investigate.
  registerActivity(TOPICS.pluginProgress, { defaultImpact: "debug", defaultActor: "app",
    renderers: { "*": (r) => {
      const name = r.subject?.label || r.subject?.id || r.details?.name || "a plugin";
      const phase = r.details?.phase;
      return phase ? `${phase} ${name}` : `working on ${name}`;
    } } });
}

// Error-level log writes mirror onto the activity bus as a "log.error" event.
// SUPPRESS guards against re-entrancy if emitting itself ever logged at error level.
let SUPPRESS = false;

registerActivity("log.error", { defaultImpact: "error", defaultActor: "system",
  renderers: { error: (r) => String(r.details?.message ?? "error") } });

setErrorActivityHook((name: string, message: string) => {
  if (SUPPRESS) return;
  SUPPRESS = true;
  try {
    emitEvent({ topic: "log.error", action: "error", impact: "error", subject: { kind: "plugin", id: name }, details: { message } }, name);
  } finally { SUPPRESS = false; }
});

setConfigChangeHook((name, key, change, configDir) => {
  emitEvent({
    topic: "config.changed",
    action: "config_changed",
    actor: "user",
    subject: { kind: "config-key", id: name, label: name },
    target: configDir ? { home: configDir } : undefined,
    changes: change ? [change] : undefined,
    details: { name, key },
  }, name);
});

// Newest-first within one home: segments are walked newest to oldest, and each
// segment's records are reversed because a segment is written oldest first. Stops
// as soon as enough matches exist, so keeping history forever costs nothing to read.
function collectHomeRecords(home: string, query: ActivityQuery, needed: number): ActivityRecord[] {
  const out: ActivityRecord[] = [];
  // An explicit impacts filter wins; otherwise the home's own floor applies, so a
  // reader never has to sift through what that home considers noise. This is what
  // keeps raw publishes (which bypass the write-side gate) from crowding a surface.
  const floor = query.impacts ? -1 : (IMPACT_ORDER[String(globalSetting("activityMinImpact", "info", home))] ?? IMPACT_ORDER.info);
  for (const path of segmentPathsNewestFirst(home)) {
    if (out.length >= needed) break;
    let text: string;
    try { if (!existsSync(path)) continue; text = readFileSync(path, "utf8"); } catch { continue; }
    const envelopes = parseEnvelopeText(text);
    for (let i = envelopes.length - 1; i >= 0; i--) {
      const rec = normalizeActivity(envelopes[i], home);
      if ((IMPACT_ORDER[rec.impact] ?? IMPACT_ORDER.info) < floor) continue;
      if (!matchesQuery(rec, query)) continue;
      if (!afterCursor(rec, query.cursor)) continue;
      out.push(rec);
      if (out.length >= needed) break;
    }
  }
  return out;
}

function matchesQuery(rec: ActivityRecord, q: ActivityQuery): boolean {
  if (q.impacts && !q.impacts.includes(rec.impact)) return false;
  if (q.sources && !q.sources.includes(rec.source)) return false;
  if (q.topics && !q.topics.includes(rec.topic)) return false;
  if (q.subjects) {
    if (!rec.subject) return false;
    const key1 = rec.subject.kind;
    const key2 = rec.subject.kind + ":" + (rec.subject.id ?? "");
    if (!q.subjects.includes(key1) && !q.subjects.includes(key2)) return false;
  }
  if (q.since && rec.ts < q.since) return false;
  if (q.until && rec.ts > q.until) return false;
  if (q.search) {
    const hay = (rec.text + " " + JSON.stringify(rec.details)).toLowerCase();
    if (!hay.includes(q.search.toLowerCase())) return false;
  }
  return true;
}

/**
 * Total order for activity records: newest first by wall-clock time, then by
 * each record's own emission sequence for a same-millisecond tie, then by id
 * text as a last resort for records written before seq existed. The merge sort
 * and the pagination cursor both call this, so a page boundary can never split
 * a same-millisecond run and drop a record between pages.
 * @remarks
 * seq is monotonic only within the process that emitted it, so two
 * different processes racing into the same home at the same millisecond can
 * still tie and fall through to the id-based last resort.
 */
function compareRecordsNewestFirst(a: RecordOrder, b: RecordOrder): number {
  return (b.ts - a.ts) || ((b.seq ?? -1) - (a.seq ?? -1)) || (a.id < b.id ? 1 : -1);
}

// Keyset pagination: the next page is everything strictly after the last record
// returned in the total order above, which is stable even as new events land
// at the head.
function afterCursor(rec: RecordOrder, cursor: string | undefined): boolean {
  const key = decodeCursor(cursor);
  if (!key) return true;
  return compareRecordsNewestFirst(rec, key) > 0;
}

function encodeCursor(rec: RecordOrder): string {
  return Buffer.from(`${rec.ts}:${rec.seq ?? -1}:${rec.id}`).toString("base64");
}

function decodeCursor(cursor: string | undefined): RecordOrder | null {
  if (!cursor) return null;
  try {
    const text = Buffer.from(String(cursor), "base64").toString("utf8");
    const firstSep = text.indexOf(":");
    const secondSep = firstSep < 0 ? -1 : text.indexOf(":", firstSep + 1);
    if (secondSep < 0) return null;
    const ts = Number(text.slice(0, firstSep));
    const seq = Number(text.slice(firstSep + 1, secondSep));
    const id = text.slice(secondSep + 1);
    return Number.isFinite(ts) && Number.isFinite(seq) && id ? { ts, seq, id } : null;
  } catch { return null; }
}

// Direct, non-consuming read across one or more homes: walks every retained
// segment newest-first per home with early exit, merges, and paginates via an
// opaque keyset cursor. Never reads or writes a drain cursor, so it never competes
// with drain() consumers over the same events.
/**
 * Reads recorded activity across one or more homes, newest first.
 *
 * @param homes the app homes to read, de-duplicated by path.
 * @param query which slice to read.
 * @returns one page, with the cursor the next call takes when more remain.
 * @remarks
 * Never reads or writes a drain cursor, so it never competes with a drain consumer over the same
 * events.
 */
export function readActivity(
  homes: Iterable<string>,
  query: ActivityQuery = {},
): ActivityReadPage {
  const q = query || {};
  const limit = q.limit ?? 200;
  const all: ActivityRecord[] = [];
  for (const home of new Set(homes)) all.push(...collectHomeRecords(home, q, limit + 1));
  all.sort(compareRecordsNewestFirst);
  const page = all.slice(0, limit);
  const nextCursor = all.length > limit && page.length > 0 ? encodeCursor(page[page.length - 1]) : undefined;
  return { records: page, nextCursor };
}
