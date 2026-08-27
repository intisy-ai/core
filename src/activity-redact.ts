// What is safe to record. Activity captures before/after values so a reader can see what actually
// changed, which makes one central denylist the only thing standing between that and a leaked
// credential. Everything funnels through here.
//
// The denylist itself is single-sourced in Java (Redaction, activity/) behind CoreJs's exports: a
// drift between two implementations of THIS rule is a leaked credential, not a cosmetic difference.
import type { ValueChange } from "./activity.types.js";
import { getCore } from "./core-teavm-loader.js";

/**
 * Whether the value under a key must never be recorded.
 *
 * @param key the configuration key to judge.
 * @returns true when the key names a secret.
 */
export function isSecretKey(key: string): boolean {
  return getCore().isSecretKey(String(key ?? ""));
}

// A plain constructor, not a decision: crossing the boundary to build an object literal would cost a
// serialisation round trip and answer nothing the caller does not already know.
/**
 * Describes one changed value, redacting it when its key names a secret.
 *
 * @param key what changed.
 * @param from the old value.
 * @param to the new value.
 * @returns the change, carrying the values or the redaction marker.
 */
export function describeChange(key: string, from: unknown, to: unknown): ValueChange {
  return { key, from, to };
}

/**
 * Redacts a whole change list, keeping every key visible.
 *
 * @param changes the changes to redact.
 * @returns each change either captured or reduced to its key and the redaction marker.
 */
export function redactChanges(changes: ValueChange[]): ValueChange[] {
  if (!Array.isArray(changes)) return [];
  return JSON.parse(getCore().redactChanges(JSON.stringify(changes)));
}

/**
 * Removes any credential interpolated into a message.
 *
 * @param message the text to redact.
 * @returns the message with credentials replaced.
 */
export function redactMessage(message: string): string {
  if (typeof message !== "string" || !message) return message;
  return getCore().redactMessage(message);
}
