import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

// Scans the folder instead of listing files by name, so a file added in a later
// phase is guarded automatically instead of silently escaping this check. Test
// files are excluded because they legitimately use real app/plugin names as
// fixture data (e.g. asserting redaction against a "wakatime" subject).
// Note: [\w.-] (not [\w-]) so a dotted name like activity.types.ts still matches;
// test files are excluded separately below regardless of this pattern.
const SURFACE_PATTERN = /^activity[\w.-]*\.ts$/;

function activitySurfaceFiles(): string[] {
  return readdirSync(__dirname).filter((name) => SURFACE_PATTERN.test(name) && !name.endsWith(".test.ts"));
}

// Core must never name an app, vendor, or plugin: identity arrives as data from the
// app registry and as caller-supplied strings. A hit here means the pipeline grew a
// dependency on something it must stay generic about.
const FORBIDDEN = ["claude", "opencode", "cairn", "antigravity", "anthropic", "gemini", "openai", "wakatime", "plugin-updater", "sync-bridge", "config-ledger"];

describe("activity surface stays app-agnostic", () => {
  const files = activitySurfaceFiles();

  it("found the activity surface files to guard", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} names no app, vendor, or plugin`, () => {
      const text = readFileSync(join(__dirname, file), "utf8").toLowerCase();
      const hits = FORBIDDEN.filter((name) => text.includes(name));
      expect(hits).toEqual([]);
    });
  }
});
