// Small fs helpers shared across plugins: atomic writes (temp + rename so a reader
// never sees a half-written file) and comment-tolerant JSON reads.

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "fs";
import { dirname } from "path";
import { randomBytes } from "crypto";

/**
 * Creates a directory and every parent it needs, doing nothing when it exists.
 *
 * @param dir the directory to create.
 */
export function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Writes a file so a reader never sees it half-written.
 *
 * @param file where to write.
 * @param content what to write.
 */
export function atomicWrite(file: string, content: string): void {
  ensureDir(dirname(file));
  const tmp = file + "." + randomBytes(6).toString("hex") + ".tmp";
  writeFileSync(tmp, content, "utf8");
  renameSync(tmp, file);
}

// returns the parsed JSON, or `fallback` if the file is absent OR unparseable.
// strips // line comments first (our config files occasionally carry them).
/**
 * Reads a JSON file, answering the fallback rather than throwing.
 *
 * @param file the file to read.
 * @param fallback what to answer when it is absent or malformed.
 * @returns the parsed value, or the fallback.
 */
export function readJson(file: string, fallback: unknown = null): unknown {
  if (!existsSync(file)) return fallback;
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^\s*\/\/[^\n]*/gm, ""));
  } catch {
    return fallback;
  }
}

/**
 * Writes a value as formatted JSON, atomically.
 *
 * @param file where to write.
 * @param value what to write.
 */
export function writeJson(file: string, value: unknown): void {
  atomicWrite(file, JSON.stringify(value, null, 2) + "\n");
}
