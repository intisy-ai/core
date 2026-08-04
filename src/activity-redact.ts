// @ts-nocheck
// What is safe to record. Activity captures before/after values so a reader can
// see what actually changed, which makes one central denylist the only thing
// standing between that and a leaked credential. Everything funnels through here.

import type { ValueChange } from "./activity.types.js";

// Substrings caught anywhere in the (lowercased) key, including run together with
// no separator (apikeys, x_api_key_value).
const SECRET_SUBSTRINGS = ["token", "secret", "password", "passwd", "passphrase", "credential", "cookie", "authorization", "apikey", "api_key", "private"];
// Whole word segments (see splitSegments) that are only secret as a complete word,
// never as a substring: "auth" would otherwise redact the ordinary "author" field,
// and "key" would redact "monkey"/"keybindings".
const SECRET_SEGMENTS = ["key", "keys", "auth", "oauth", "bearer", "session"];
const MAX_VALUE_CHARS = 200;

// Splits a key into its word segments on `_`, `-`, `.`, and camelCase boundaries,
// lowercased. Used for SECRET_SEGMENTS so a segment must match a whole word
// (apiKey, private_key, sessionId, x-api-key) rather than a mere substring.
function splitSegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .split(/[_\-.]+/)
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

export function isSecretKey(key: string): boolean {
  const raw = String(key ?? "");
  const normalized = raw.toLowerCase();
  if (SECRET_SUBSTRINGS.some((part) => normalized.includes(part))) return true;
  return splitSegments(raw).some((segment) => SECRET_SEGMENTS.includes(segment));
}

function clamp(value: unknown): unknown {
  return typeof value === "string" && value.length > MAX_VALUE_CHARS ? value.slice(0, MAX_VALUE_CHARS) : value;
}

export function describeChange(key: string, from: unknown, to: unknown): ValueChange {
  return { key, from, to };
}

export function redactChanges(changes: ValueChange[]): ValueChange[] {
  if (!Array.isArray(changes)) return [];
  return changes.map((change) => {
    if (!change || typeof change.key !== "string") return { key: String(change?.key), redacted: true };
    if (isSecretKey(change.key)) return { key: change.key, redacted: true };
    return { key: change.key, from: clamp(change.from), to: clamp(change.to) };
  });
}
