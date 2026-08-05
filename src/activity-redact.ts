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
// non-secret settings. Same reasoning covers "access" (the OAuth access token
// sitting next to refresh), "id_token", and "jwt": accessible/accessCount/
// lastAccessed/jwtEnabled/id_token_hint_url stay visible because none of them
// END in one of these segments.
const SECRET_FINAL_PATH_SEGMENTS = ["refresh", "creds", "credentials", "access", "id_token", "jwt"];
const MAX_VALUE_CHARS = 200;
const MAX_ARRAY_ITEMS = 10;
const ARRAY_MARKER = "[array]";
const OBJECT_MARKER = "[object]";
// A URL carrying inline userinfo credentials: scheme://user:pass@host..., password
// value included right in the string, so no key-based rule can catch it. The
// username class excludes ":" (a username can never contain one) so the two
// unbounded classes can never both claim the same colon: that ambiguity is what
// caused quadratic backtracking on a long colon-heavy non-matching string.
const CREDENTIAL_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\/[^/@:]+:[^/@]+@/i;
// Userinfo credentials sit immediately after the scheme by definition, so scanning
// only this leading slice loses no real detection while bounding the regex's work
// regardless of how long the full value is.
const CREDENTIAL_URL_SCAN_CHARS = 2048;

// What replaces a credential inside a message. A change's value is dropped entirely
// (redacted: true); a message keeps its shape so the sentence still reads.
const REDACTED = "<redacted>";

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

// A credential can also ride in a URL's query string as a named parameter
// (?api_key=...) rather than as userinfo. Reusing isSecretKey on each parameter
// name is the one definition of "credential-looking key" instead of inventing a
// second notion just for query strings.
function hasCredentialQueryParam(scan: string): boolean {
  const at = scan.indexOf("?");
  if (at < 0) return false;
  const query = scan.slice(at + 1).split("#")[0];
  return query.split("&").some((pair) => isSecretKey(pair.split("=")[0]));
}

function isCredentialString(value: string): boolean {
  const scan = value.slice(0, CREDENTIAL_URL_SCAN_CHARS);
  return CREDENTIAL_URL_PATTERN.test(scan) || hasCredentialQueryParam(scan);
}

// A credential-bearing value can also arrive as an array of URLs (e.g. a
// "proxies" list), so this checks every string item, not just a top-level string.
function hasCredentialUrl(value: unknown): boolean {
  if (typeof value === "string") return isCredentialString(value);
  if (Array.isArray(value)) return value.some((v) => typeof v === "string" && isCredentialString(v));
  return false;
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

// A human-readable message is promoted into the record's searchable text and kept for
// as long as retention allows, so a credential interpolated into a log line must not
// survive it. Both patterns use bounded, whitespace-excluding classes so scanning a
// long message stays linear.
const MESSAGE_USERINFO = /([a-z][a-z0-9+.-]{0,20}:\/\/)[^\s/@:]{1,256}:[^\s/@]{1,256}@/gi;
const MESSAGE_QUERY_PARAM = /([?&])([\w.-]{1,64})=([^\s&#]{1,512})/g;

export function redactMessage(message: string): string {
  if (typeof message !== "string" || !message) return message;
  return message
    .replace(MESSAGE_USERINFO, (_m, scheme) => `${scheme}${REDACTED}@`)
    .replace(MESSAGE_QUERY_PARAM, (whole, sep, key) => (isSecretKey(key) ? `${sep}${key}=${REDACTED}` : whole));
}
