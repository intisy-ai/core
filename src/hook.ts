// @ts-nocheck
// opencode invokes EVERY exported function as a plugin hook, passing a context
// object. A library function called normally gets a string (or nothing) first.
// Exports that must survive being called as a hook use this to return an inert
// value instead of running their real logic.

export function isHookInvocation(firstArg: unknown): boolean {
  return firstArg !== undefined && typeof firstArg !== "string";
}
