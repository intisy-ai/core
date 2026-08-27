// opencode invokes EVERY exported function as a plugin hook, passing a context
// object. A library function called normally gets a string (or nothing) first.
// Exports that must survive being called as a hook use this to return an inert
// value instead of running their real logic.

/**
 * Whether this process was started as an app hook rather than by a person.
 *
 * @param firstArg the first argument the process received.
 * @returns true when the caller is the app, which is what keeps output off the hook channel.
 */
export function isHookInvocation(firstArg: unknown): boolean {
  return firstArg !== undefined && typeof firstArg !== "string";
}
