// Generated from Java sources. Do not edit.

/**
 * Registers a plugin's capability schema, merged across calls.
 *
 * @remarks
 * A malformed entry inside the schema is dropped rather than rejected, so one bad
 * declaration never crashes app launch.
 *
 * @param name - the plugin declaring the schema.
 * @param schemaJson - the declaration as JSON.
 */
export declare function defineCapabilities(name: string, schemaJson: string): void;
/**
 * What the plugin declared, as JSON.
 *
 * @remarks
 * Only the non-empty arrays are carried, so a plugin that declared nothing yields an
 * empty object rather than a shape full of empty lists.
 *
 * @param name - the plugin to read.
 * @returns the declaration as JSON.
 */
export declare function getCapabilities(name: string): string;
/**
 * Whether a key's value must never be recorded.
 *
 * @param key - the configuration key to judge.
 * @returns true when the key's value must never be recorded.
 */
export declare function isSecretKey(key: string): boolean;
/**
 * Redacts a change list, given the `{key, from, to`} array as JSON.
 *
 * @remarks
 * Each entry comes back either captured or reduced to `{key, redacted: true`},
 * so a caller cannot tell a redacted value from a missing one, which is the point.
 *
 * @param changesJson - the change array as JSON.
 * @returns the redacted array as JSON.
 */
export declare function redactChanges(changesJson: string): string;
/**
 * Redacts one message, returning the bare message rather than a JSON string.
 *
 * @param message - the message to redact.
 * @returns the message with any credential in it replaced.
 */
export declare function redactMessage(message: string): string;

