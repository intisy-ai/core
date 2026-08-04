// @ts-nocheck
// The Activity convention: a thin, normalized layer over the event bus. emitEvent
// wraps publish() with a standardized { action, actor, impact, subject, details }
// payload; a registerable registry supplies per-topic defaults (for back-compat with
// raw publishers) and human-readable render templates. Both the Cairn Activity tab
// and the loader TUI render through renderActivity, so activity is visible with Cairn
// closed. All operations are best-effort and never throw (they inherit bus guarantees).

import { publish, TOPICS } from "./bus.js";

const DEFAULT_ACTOR = "system";
const DEFAULT_IMPACT = "info";

const REGISTRY = new Map(); // topic -> { defaultImpact, defaultActor, renderers }

export function registerActivity(topic, def = {}) {
  const existing = REGISTRY.get(topic) || { renderers: {} };
  REGISTRY.set(topic, {
    defaultImpact: def.defaultImpact ?? existing.defaultImpact,
    defaultActor: def.defaultActor ?? existing.defaultActor,
    renderers: { ...existing.renderers, ...(def.renderers || {}) },
  });
}

function topicDefaults(topic) {
  return REGISTRY.get(topic) || {};
}

const LEVEL_TO_IMPACT = { info: "info", success: "notice", warning: "warning", error: "error" };

export function emitEvent(spec, source = "core") {
  const d = topicDefaults(spec.topic);
  const payload = {
    action: spec.action,
    actor: spec.actor ?? d.defaultActor ?? DEFAULT_ACTOR,
    impact: spec.impact ?? d.defaultImpact ?? DEFAULT_IMPACT,
    subject: spec.subject,
    details: spec.details ?? {},
  };
  return publish(spec.topic, payload, source);
}

export function normalizeActivity(envelope, home = "") {
  const p = envelope.payload || {};
  const d = topicDefaults(envelope.topic);
  const hasActivity = typeof p.action === "string";
  const action = hasActivity ? p.action : impliedAction(envelope.topic, p);
  const impact = p.impact ?? (typeof p.level === "string" ? LEVEL_TO_IMPACT[p.level] : undefined) ?? d.defaultImpact ?? DEFAULT_IMPACT;
  const actor = p.actor ?? d.defaultActor ?? DEFAULT_ACTOR;
  const rec = {
    id: envelope.id,
    ts: envelope.ts,
    home,
    topic: envelope.topic,
    action,
    actor,
    impact,
    source: envelope.source,
    subject: p.subject,
    details: hasActivity ? (p.details || {}) : stripKnown(p),
  };
  return { ...rec, text: renderActivity(rec) };
}

// A raw (pre-emitEvent) publisher has no action; infer a stable verb from the topic
// so old events still render. Keeps back-compat without an envelope-version bump.
function impliedAction(topic, payload) {
  if (topic === TOPICS.notification) return "notified";
  if (topic === TOPICS.proxyStatus) return payload.up ? "started" : "stopped";
  if (topic === TOPICS.accountRateLimited) return "rate_limited";
  if (topic === TOPICS.configChanged) return "config_changed";
  if (topic === TOPICS.pluginInstalled) return "installed";
  return topic.replace(/[.]/g, "_");
}

function stripKnown(payload) {
  const { action, actor, impact, subject, ...rest } = payload;
  return rest;
}

export function renderActivity(rec) {
  const d = topicDefaults(rec.topic);
  const fn = d.renderers?.[rec.action] || d.renderers?.["*"];
  if (fn) { try { return fn(rec); } catch { /* fall through to generic */ } }
  const label = rec.subject?.label || rec.subject?.id || "";
  return `${rec.source} ${rec.action}${label ? " " + label : ""}`.trim();
}

registerBuiltins();

function registerBuiltins() {
  registerActivity(TOPICS.notification, { defaultImpact: "info", defaultActor: "system",
    renderers: { notified: (r) => String(r.details?.message ?? "notification") } });
  registerActivity(TOPICS.proxyStatus, { defaultImpact: "notice", defaultActor: "system",
    renderers: { started: () => "Proxy started", stopped: () => "Proxy stopped" } });
  registerActivity(TOPICS.accountRateLimited, { defaultImpact: "warning", defaultActor: "system",
    renderers: { rate_limited: (r) => `${r.subject?.label || r.subject?.id || "account"} rate-limited` } });
  registerActivity(TOPICS.configChanged, { defaultImpact: "notice", defaultActor: "user",
    renderers: { config_changed: (r) => `Config changed: ${r.subject?.id || r.details?.name || ""}` } });
  registerActivity(TOPICS.pluginInstalled, { defaultImpact: "notice", defaultActor: "system",
    renderers: { installed: (r) => `Installed ${r.subject?.label || r.subject?.id || ""} ${r.details?.version || ""}`.trim() } });
  registerActivity(TOPICS.syncCompleted, { defaultImpact: "notice", defaultActor: "system" });
}
