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
// Dot/underscore/hyphen path segments (NOT camelCase words) that are only secret as
// the FINAL segment of a key, e.g. "accounts.0.refresh" (core-auth's OAuth refresh
// token field). Anywhere-segment or substring matching would also redact
// refreshInterval/refreshModels/refreshQuota/autoRefresh, which are ordinary
// non-secret settings.
const SECRET_FINAL_PATH_SEGMENTS = ["refresh", "creds", "credentials"];
const MAX_VALUE_CHARS = 200;
const MAX_ARRAY_ITEMS = 10;
const ARRAY_MARKER = "[array]";
const OBJECT_MARKER = "[object]";
// A URL carrying inline userinfo credentials: scheme://user:pass@host..., password
// value included right in the string, so no key-based rule can catch it.
const CREDENTIAL_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^/@]+:[^/@]+@/i;

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

// Splits a key into its dot/underscore/hyphen path segments only, lowercased,
// WITHOUT the camelCase split splitSegments does: "autoRefresh" stays one segment
// so it is never mistaken for a key path ending in "refresh".
function finalPathSegment(key: string): string {
  const parts = key.split(/[_\-.]+/).filter(Boolean);
  return (parts[parts.length - 1] ?? key).toLowerCase();
}

export function isSecretKey(key: string): boolean {
  const raw = String(key ?? "");
  const normalized = raw.toLowerCase();
  if (SECRET_SUBSTRINGS.some((part) => normalized.includes(part))) return true;
  if (splitSegments(raw).some((segment) => SECRET_SEGMENTS.includes(segment))) return true;
  return SECRET_FINAL_PATH_SEGMENTS.includes(finalPathSegment(raw));
}

function hasCredentialUrl(value: unknown): boolean {
  return typeof value === "string" && CREDENTIAL_URL_PATTERN.test(value);
}

function truncate(value: string): string {
  return value.length > MAX_VALUE_CHARS ? value.slice(0, MAX_VALUE_CHARS) : value;
}

function isScalar(value: unknown): boolean {
  return value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

// Only scalars (and short arrays of scalars) are ever captured. A whole object,
// however innocuous it looks at a given key, is never recorded or recursed into:
// that is the only way to guarantee a credential nested under an unrelated key
// (subject.details, a config blob) can never reach bus.jsonl.
function captureValue(value: unknown): unknown {
  try {
    if (typeof value === "string") return truncate(value);
    if (isScalar(value)) return value;
    if (Array.isArray(value)) {
      if (value.length <= MAX_ARRAY_ITEMS && value.every(isScalar)) {
        return value.map((v) => (typeof v === "string" ? truncate(v) : v));
      }
      return ARRAY_MARKER;
    }
    return OBJECT_MARKER;
  } catch {
    return OBJECT_MARKER;
  }
}

export function describeChange(key: string, from: unknown, to: unknown): ValueChange {
  return { key, from, to };
}

export function redactChanges(changes: ValueChange[]): ValueChange[] {
  if (!Array.isArray(changes)) return [];
  return changes.map((change) => {
    try {
      if (!change || typeof change.key !== "string") return { key: String(change?.key), redacted: true };
      if (isSecretKey(change.key)) return { key: change.key, redacted: true };
      if (hasCredentialUrl(change.from) || hasCredentialUrl(change.to)) return { key: change.key, redacted: true };
      return { key: change.key, from: captureValue(change.from), to: captureValue(change.to) };
    } catch {
      return { key: "unknown", redacted: true };
    }
  });
}
