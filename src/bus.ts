// @ts-nocheck
// The event bus: a single append-only JSONL log per app home that every component
// publishes to and subscribes/drains from, replacing the scattered notification,
// status, and change channels with one typed event stream. Daemon-free (a plain
// file), so ephemeral CLIs and long-lived processes share it. Every operation is
// best-effort: bus IO never throws into a caller.

import { existsSync, appendFileSync, statSync, renameSync, readFileSync, readdirSync, openSync, closeSync, unlinkSync, watch } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { getAppConfigDir } from "./env.js";
import { ensureDir, atomicWrite, readJson } from "./files.js";
import { globalSetting } from "./log.js";

const ENVELOPE_VERSION = 1;
const SIZE_CAP_BYTES = 1_000_000;
const DEFAULT_POLL_MS = 1500;
const EVENTS_SUBDIR = "events";
const LOG_NAME = "bus.jsonl";
const ROTATION_FILE = ".rotation";
const ROTATE_LOCK = ".rotate.lock";

export const TOPICS = {
  notification: "notification",
  proxyStatus: "proxy.status",
  accountRateLimited: "account.rate_limited",
  configChanged: "config.changed",
  configSnapshot: "config.snapshot",
  configProfileChanged: "config.profile_changed",
  pluginProgress: "plugin.progress",
  pluginInstalled: "plugin.installed",
  syncCompleted: "sync.completed",
};

let ID_COUNTER = 0;

function eventsDir(home) {
  return join(home || getAppConfigDir(), EVENTS_SUBDIR);
}

export function busLogPath(home) {
  return join(eventsDir(home), LOG_NAME);
}

// bus.<k>.jsonl holds the events written while the rotation counter was k-1.
function segmentPath(home, k) {
  return join(eventsDir(home), `bus.${k}.jsonl`);
}

function cursorPath(home, consumerId) {
  return join(eventsDir(home), "cursors", consumerId.replace(/[^\w.-]/g, "_"));
}

function makeId(source) {
  ID_COUNTER += 1;
  return `${source}-${Date.now().toString(36)}-${ID_COUNTER.toString(36)}-${randomBytes(3).toString("hex")}`;
}

function sizeOf(path) {
  try { return existsSync(path) ? statSync(path).size : 0; } catch { return 0; }
}

function readRotation(home) {
  const v = readJson(join(eventsDir(home), ROTATION_FILE), null);
  return v && typeof v.n === "number" ? v.n : 0;
}

function isEnvelope(e) {
  return e && typeof e === "object"
    && e.v === ENVELOPE_VERSION
    && typeof e.id === "string"
    && typeof e.ts === "number"
    && typeof e.topic === "string";
}

function parseLines(lines) {
  const out = [];
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (isEnvelope(e)) out.push(e);
    } catch {}
  }
  return out;
}

// The one place a bus line becomes an envelope. Exported so readers (Activity)
// validate exactly what the bus itself accepts, instead of a second, weaker copy.
export function parseEnvelopeText(text) {
  return parseLines(String(text || "").split("\n").filter((l) => l.length > 0));
}

// Read complete (newline-terminated) lines from `fromOffset` onward, leaving a
// half-written trailing line for the next read. Returns the new byte offset,
// which only advances past the last complete newline.
function readComplete(path, fromOffset) {
  if (!existsSync(path)) return { lines: [], nextOffset: fromOffset };
  let buf;
  try { buf = readFileSync(path); } catch { return { lines: [], nextOffset: fromOffset }; }
  if (fromOffset >= buf.length) return { lines: [], nextOffset: buf.length };
  const slice = buf.subarray(fromOffset);
  const lastNewline = slice.lastIndexOf(0x0a);
  if (lastNewline < 0) return { lines: [], nextOffset: fromOffset };
  const text = slice.subarray(0, lastNewline).toString("utf8");
  const lines = text.length ? text.split("\n").filter((l) => l.length > 0) : [];
  return { lines, nextOffset: fromOffset + lastNewline + 1 };
}

// All events at or after `cursor`, plus the advanced cursor. A cursor at rotation r
// resumes inside bus.<r+1>.jsonl (or the live log when r is the current rotation),
// reads each later segment whole, then the live log. Segments that no longer exist
// are skipped (pruning never breaks a consumer), and every rotation is walked so no
// event is skipped or delivered twice.
function readSince(home, cursor) {
  const rotation = readRotation(home);
  if (cursor.rotation >= rotation) {
    const read = readComplete(busLogPath(home), cursor.offset);
    return { events: parseLines(read.lines), cursor: { rotation, offset: read.nextOffset } };
  }
  const lines = [];
  const resume = readComplete(segmentPath(home, cursor.rotation + 1), cursor.offset);
  lines.push(...resume.lines);
  for (let r = cursor.rotation + 1; r < rotation; r++) {
    lines.push(...readComplete(segmentPath(home, r + 1), 0).lines);
  }
  const fresh = readComplete(busLogPath(home), 0);
  lines.push(...fresh.lines);
  return { events: parseLines(lines), cursor: { rotation, offset: fresh.nextOffset } };
}

function endCursor(home) {
  return { rotation: readRotation(home), offset: sizeOf(busLogPath(home)) };
}

// A new drain consumer starts from the beginning of the log (queue semantics:
// deliver everything not yet acknowledged), unlike a live subscriber which starts
// at the current end.
function readCursor(home, consumerId) {
  const c = readJson(cursorPath(home, consumerId), null);
  if (c && typeof c.rotation === "number" && typeof c.offset === "number") return c;
  return { rotation: 0, offset: 0 };
}

function writeCursor(home, consumerId, cursor) {
  try { atomicWrite(cursorPath(home, consumerId), JSON.stringify(cursor)); } catch {}
}

function segmentNumbers(home) {
  try {
    return readdirSync(eventsDir(home))
      .map((name) => /^bus\.(\d+)\.jsonl$/.exec(name))
      .filter(Boolean)
      .map((m) => Number(m[1]))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

// Newest first: the live log, then each retained segment descending. Exported so
// readers walk history in one order without re-deriving the naming scheme.
export function segmentPathsNewestFirst(home) {
  const numbers = segmentNumbers(home).sort((a, b) => b - a);
  return [busLogPath(home), ...numbers.map((k) => segmentPath(home, k))];
}

function numberSetting(home, key) {
  const raw = globalSetting(key, 0, home);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Retention drops whole segments, oldest first, and never touches the live log, so a
// record is either fully present or fully gone. Unset limits (0) mean keep forever.
function pruneSegments(home) {
  try {
    const maxBytes = numberSetting(home, "activityMaxBytes");
    const maxDays = numberSetting(home, "activityMaxDays");
    if (!maxBytes && !maxDays) return;
    let numbers = segmentNumbers(home);

    if (maxDays) {
      const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
      for (const k of numbers) {
        const path = segmentPath(home, k);
        let mtime = 0;
        try { mtime = statSync(path).mtimeMs; } catch { continue; }
        if (mtime < cutoff) { try { unlinkSync(path); } catch {} }
      }
      numbers = segmentNumbers(home);
    }

    if (maxBytes) {
      let total = numbers.reduce((sum, k) => sum + sizeOf(segmentPath(home, k)), 0) + sizeOf(busLogPath(home));
      for (const k of numbers) {
        if (total <= maxBytes) break;
        const size = sizeOf(segmentPath(home, k));
        try { unlinkSync(segmentPath(home, k)); total -= size; } catch {}
      }
    }
  } catch {}
}

function maybeRotate(home) {
  const path = busLogPath(home);
  if (sizeOf(path) < SIZE_CAP_BYTES) return;
  const lock = join(eventsDir(home), ROTATE_LOCK);
  let fd;
  try { fd = openSync(lock, "wx"); } catch { return; }
  try {
    if (sizeOf(path) >= SIZE_CAP_BYTES) {
      // Never trust the counter alone: a deleted/unparseable .rotation would read as 0
      // and a lost update after a prior rename would leave it stale, either way
      // colliding with a segment that's already on disk. The highest existing segment
      // number is the floor, so the next name can never overwrite a retained one.
      const next = Math.max(readRotation(home), segmentNumbers(home).at(-1) ?? 0) + 1;
      renameSync(path, segmentPath(home, next));
      atomicWrite(join(eventsDir(home), ROTATION_FILE), JSON.stringify({ n: next }));
      pruneSegments(home);
    }
  } catch {} finally {
    try { closeSync(fd); } catch {}
    try { unlinkSync(lock); } catch {}
  }
}

// Typed convenience over publish for the notification topic, the one channel every
// host wires. Saves callers from repeating TOPICS.notification + the payload shape.
export function publishNotification(message, level = "info", source = "core") {
  return publish(TOPICS.notification, { message, level }, source);
}

// Append one event. Returns the envelope (for the caller's own use) or null if the
// append failed; either way it never throws.
export function publish(topic, payload, source = "core") {
  try {
    const home = getAppConfigDir();
    ensureDir(eventsDir(home));
    maybeRotate(home);
    const envelope = { v: ENVELOPE_VERSION, id: makeId(source), ts: Date.now(), topic, source, payload: payload ?? {} };
    appendFileSync(busLogPath(home), JSON.stringify(envelope) + "\n");
    return envelope;
  } catch {
    return null;
  }
}

// Deliver events since the consumer's persisted cursor in one home, then advance
// that home's cursor. Returns how many events were delivered from this home.
function drainHome(home, consumerId, handler) {
  try {
    ensureDir(join(eventsDir(home), "cursors"));
    const { events, cursor } = readSince(home, readCursor(home, consumerId));
    for (const event of events) { try { handler(event); } catch {} }
    writeCursor(home, consumerId, cursor);
    return events.length;
  } catch {
    return 0;
  }
}

// Deliver events since the consumer's persisted cursor, then advance it. A brand
// new consumer starts at the current end (no historical backlog replay). Returns
// how many events were delivered.
export function drain(consumerId, handler) {
  return drainHome(getAppConfigDir(), consumerId, handler);
}

// Drain several homes under one consumer id, each with its own cursor, so a
// dashboard can observe events across every app home from one call. Homes are
// de-duplicated by path. Returns the total delivered across all homes.
export function drainHomes(homes, consumerId, handler) {
  let total = 0;
  for (const home of new Set(homes)) total += drainHome(home, consumerId, handler);
  return total;
}

// Long-lived subscription to one home. Delivery rides fs.watch for low latency
// with an interval poll as a reliability backstop; both advance the same in-memory
// cursor, so an event is delivered once. Returns an unsubscribe fn.
function subscribeHome(home, topics, handler, opts = {}) {
  const wanted = topics === "*" ? null : new Set(Array.isArray(topics) ? topics : [topics]);
  ensureDir(eventsDir(home));
  let cursor = opts.fromStart ? { rotation: 0, offset: 0 } : endCursor(home);
  let closed = false;

  const pump = () => {
    if (closed) return;
    const result = readSince(home, cursor);
    cursor = result.cursor;
    for (const event of result.events) {
      if (!wanted || wanted.has(event.topic)) { try { handler(event); } catch {} }
    }
  };

  let watcher;
  try { watcher = watch(busLogPath(home), { persistent: false }, pump); } catch {}
  const timer = setInterval(pump, opts.pollMs || DEFAULT_POLL_MS);
  if (typeof timer.unref === "function") timer.unref();
  if (opts.fromStart) pump();

  return () => {
    closed = true;
    try { watcher && watcher.close(); } catch {}
    clearInterval(timer);
  };
}

// Long-lived subscription: invokes handler for each matching event as it lands.
// `topics` is a topic, an array of topics, or "*" for all. Returns an unsubscribe fn.
export function subscribe(topics, handler, opts = {}) {
  return subscribeHome(getAppConfigDir(), topics, handler, opts);
}

// Subscribe across several homes with one handler, so a dashboard can follow
// events from every app home at once. Homes are de-duplicated by path. The
// returned unsubscribe tears down all per-home subscriptions.
export function subscribeHomes(homes, topics, handler, opts = {}) {
  const offs = [...new Set(homes)].map((home) => subscribeHome(home, topics, handler, opts));
  return () => { for (const off of offs) { try { off(); } catch {} } };
}
