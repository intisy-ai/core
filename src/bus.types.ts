// Typed surface for the event bus, so TS consumers (Cairn, plugins) get payload
// types per topic. The runtime (bus.ts) is @ts-nocheck; these types are advisory.

export interface EventEnvelope<T = unknown> {
  v: 1;
  id: string;
  ts: number;
  topic: string;
  source: string;
  payload: T;
}

export type NotificationLevel = "info" | "success" | "warning" | "error";

// Known topics and their payload shapes. Unknown topics are allowed at runtime
// (forward-compatible); they just aren't in this map.
export interface TopicPayloads {
  "notification": { message: string; level: NotificationLevel };
  "proxy.status": { up: boolean; port: number };
  "account.rate_limited": { provider: string; accountId?: string; lane?: string; resetAt?: number };
  "config.changed": { name: string };
  "plugin.progress": { name: string; phase: string; pct?: number };
  "plugin.installed": { name: string; version: string };
}

export type KnownTopic = keyof TopicPayloads;

export interface Cursor {
  rotation: number;
  offset: number;
}

export interface SubscribeOptions {
  fromStart?: boolean;
  pollMs?: number;
}
