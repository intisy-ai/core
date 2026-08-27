// Accessor for the TeaVM-generated ESM staged into src/generated/ by `npm run build:teavm`.
//
// Statically imported, so getCore() cannot fail and no caller has to sequence an init first: the
// redaction entry points are synchronous and are reached from hosts that never had an init step to
// add. Mirrors core-auth's own loader.
import * as core from "./generated/core.teavm.js";

/**
 * The transpiled core module, loaded once per process.
 *
 * @returns the module holding the redaction denylist and the capability registry.
 */
export function getCore(): typeof core {
  return core;
}
