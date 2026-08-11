import { existsSync, renameSync } from "fs";
import { join } from "path";
import { DEFAULT_PATH_NAMES, type AppPathNames } from "./apps.js";

const KINDS = Object.keys(DEFAULT_PATH_NAMES) as (keyof AppPathNames)[];

// The registry resolver falls back to the conventional name when a declared one is
// unusable, which is right for reading a file someone else wrote and wrong for a name
// someone is typing in: they would watch it be accepted and then quietly ignored.
export function pathNameError(name: string): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "cannot be empty";
  if (trimmed === "." || trimmed === "..") return "cannot be . or ..";
  if (/[\\/]/.test(trimmed)) return "cannot contain a path separator";
  return null;
}

// Keyed by the kind that is wrong, empty when every name is usable.
export function validatePathNames(names: Partial<AppPathNames>): Partial<Record<keyof AppPathNames, string>> {
  const errors: Partial<Record<keyof AppPathNames, string>> = {};
  for (const kind of KINDS) {
    const error = pathNameError(names[kind] ?? "");
    if (error) errors[kind] = error;
  }
  // Two kinds sharing one directory would put each one's contents under the other, so it
  // is rejected rather than settled by whichever consumer happens to write first.
  const seen = new Map<string, keyof AppPathNames>();
  for (const kind of KINDS) {
    if (errors[kind]) continue;
    const name = (names[kind] as string).trim();
    const other = seen.get(name);
    if (other) errors[kind] = `cannot be the same as ${other}`;
    else seen.set(name, kind);
  }
  return errors;
}

export interface PathMove {
  kind: keyof AppPathNames;
  from: string;
  to: string;
  status: "moved" | "nothing-to-move" | "target-exists" | "failed";
  detail?: string;
}

export function movesFailed(moves: PathMove[]): PathMove[] {
  return moves.filter((move) => move.status === "target-exists" || move.status === "failed");
}

// Renames only the directories whose name actually changed, so an unrelated rename never
// touches a home's clones. An existing target is refused rather than written into:
// silently merging two directories' worth of clones is worse than saying it cannot be done.
export function moveAppPaths(configDir: string, from: AppPathNames, to: Partial<AppPathNames>): PathMove[] {
  const moves: PathMove[] = [];
  for (const kind of KINDS) {
    const before = from[kind];
    const after = (to[kind] ?? "").trim();
    if (!after || before === after) continue;
    const source = join(configDir, before);
    const target = join(configDir, after);
    if (!existsSync(source)) {
      moves.push({ kind, from: before, to: after, status: "nothing-to-move" });
      continue;
    }
    if (existsSync(target)) {
      moves.push({ kind, from: before, to: after, status: "target-exists" });
      continue;
    }
    try {
      renameSync(source, target);
      moves.push({ kind, from: before, to: after, status: "moved" });
    } catch (e) {
      moves.push({ kind, from: before, to: after, status: "failed", detail: (e as Error).message });
    }
  }
  return moves;
}
