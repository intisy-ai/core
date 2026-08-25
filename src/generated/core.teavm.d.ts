// Hand-authored ambient types for the TeaVM-generated ES module staged into this same directory by
// `npm run build:teavm`, from core-teavm's CoreJs @JSExport surface. The generated core.teavm.js is
// gitignored build output; this .d.ts is committed source, so tsc can type-check consumers of
// getCore() without the build having run first.

/** `Redaction.isSecretKey` -- whether a key's value must never be recorded. */
export function isSecretKey(key: string): boolean;

/**
 * `Redaction.redactChanges` -- `changesJson` is the `{key, from, to}` array; returns the redacted
 * array as JSON, each entry either captured or reduced to `{key, redacted: true}`.
 */
export function redactChanges(changesJson: string): string;

/** `Redaction.redactMessage` -- returns the bare message, not a JSON string. */
export function redactMessage(message: string): string;

/**
 * `Capabilities.define` -- registers a plugin's schema, merged across calls. A malformed entry inside
 * `schemaJson` is dropped rather than rejected, so a bad declaration never crashes app launch.
 */
export function defineCapabilities(name: string, schemaJson: string): void;

/**
 * `Capabilities.get` -- what the plugin declared, as JSON, carrying only the non-empty arrays so a
 * plugin that declared nothing yields `{}`.
 */
export function getCapabilities(name: string): string;
