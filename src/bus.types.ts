// Typed surface for the event bus, so TS consumers (Cairn, plugins) get payload
// types per topic. bus.ts implements against these; they are the contract, not a mirror.

import type {
  AccountRateLimitedEvent,
  ConfigChangedEvent,
  ConfigProfileChangedEvent,
  ConfigSnapshotEvent,
  NotificationEvent,
  NotificationLevel,
  PluginInstalledEvent,
  PluginProgressEvent,
  ProxyStatusEvent,
  SyncCompletedEvent,
} from "./generated/contracts.js";

/** How prominently a surface should show a notification. */
export type { NotificationLevel };
/**
 * One event as it is written to and read back from the log of one home.
 *
 * @typeParam T - the payload shape, which a known topic narrows and an unknown one leaves open.
 */
export interface EventEnvelope<T = unknown> {
  /** Envelope format version, which is what a reader validates before trusting the rest. */
  v: 1;
  /** Unique within the home, and the tie-breaker when two events share a millisecond. */
  id: string;
  /** When the event was appended, in epoch milliseconds. */
  ts: number;
  /**
   * Monotonic only within the emitting process, so two processes racing into one home can tie.
   * Absent on a record written before the field existed and still on disk in an older log.
   */
  seq?: number;
  /** What kind of event this is. */
  topic: string;
  /** Who appended it, normally a plugin id. */
  source: string;
  /** Whatever the topic carries. */
  payload: T;
}

// Known topics and their payload shapes. Unknown topics are allowed at runtime
// (forward-compatible); they just aren't in this map.
/**
 * The payload each known topic carries.
 *
 * @remarks
 * Every shape here is the emitted contract for that event rather than a restatement of it, so a
 * change to the Java reaches this map without anyone editing it. Unknown topics are allowed at run
 * time, which is what keeps a plugin built against a newer host working; they simply are not here.
 */
export interface TopicPayloads {
  /** Something a surface should show a person. */
  "notification": NotificationEvent;
  /** The proxy came up or went down. */
  "proxy.status": ProxyStatusEvent;
  /** An upstream refused an account for now. */
  "account.rate_limited": AccountRateLimitedEvent;
  /** One configuration value changed. */
  "config.changed": ConfigChangedEvent;
  /** A whole configuration was captured. */
  "config.snapshot": ConfigSnapshotEvent;
  /** The active configuration profile changed. */
  "config.profile_changed": ConfigProfileChangedEvent;
  /** A long-running plugin operation reported how far it has got. */
  "plugin.progress": PluginProgressEvent;
  /** A plugin finished installing. */
  "plugin.installed": PluginInstalledEvent;
  /** A cross-app reconciliation finished. */
  "sync.completed": SyncCompletedEvent;
}

/** A topic this map gives a payload shape for. */
export type KnownTopic = keyof TopicPayloads;

/**
 * How far through the log of one home a consumer has read.
 *
 * @remarks
 * The rotation is part of the position because an offset alone is meaningless once the live log has
 * been renamed to a segment.
 */
export interface Cursor {
  /** Which rotation the offset belongs to. */
  rotation: number;
  /** Byte offset into that rotation file. */
  offset: number;
}

/** What a subscription may be told to do differently. */
export interface SubscribeOptions {
  /** Start at the beginning of the log rather than at its current end. */
  fromStart?: boolean;
  /** How often the backstop poll runs, in milliseconds. */
  pollMs?: number;
}

/** Called with each event a drain or a subscription delivers. */
export type BusHandler = (event: EventEnvelope) => void;

/** Undoes a subscription. */
export type Unsubscribe = () => void;
