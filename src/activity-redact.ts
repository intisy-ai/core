// What is safe to record. Activity captures before/after values so a reader can see what actually
// changed, which makes one central denylist the only thing standing between that and a leaked
// credential. Everything funnels through here.
//
// The denylist itself is single-sourced in Java (Redaction, activity/) behind CoreJs's exports: a
// drift between two implementations of THIS rule is a leaked credential, not a cosmetic difference.
import type { ValueChange } from "./activity.types.js";
import { getCore } from "./core-teavm-loader.js";

export function isSecretKey(key: string): boolean {
  return getCore().isSecretKey(String(key ?? ""));
}

// A plain constructor, not a decision: crossing the boundary to build an object literal would cost a
// serialisation round trip and answer nothing the caller does not already know.
export function describeChange(key: string, from: unknown, to: unknown): ValueChange {
  return { key, from, to };
}

export function redactChanges(changes: ValueChange[]): ValueChange[] {
  if (!Array.isArray(changes)) return [];
  return JSON.parse(getCore().redactChanges(JSON.stringify(changes)));
}

export function redactMessage(message: string): string {
  if (typeof message !== "string" || !message) return message;
  return getCore().redactMessage(message);
}
