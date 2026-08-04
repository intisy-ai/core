import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SURFACE = ["activity.ts", "activity.types.ts", "activity-context.ts", "activity-redact.ts"];

// Core must never name an app, vendor, or plugin: identity arrives as data from the
// app registry and as caller-supplied strings. A hit here means the pipeline grew a
// dependency on something it must stay generic about.
const FORBIDDEN = ["claude", "opencode", "cairn", "antigravity", "anthropic", "gemini", "openai", "wakatime", "plugin-updater", "sync-bridge", "config-ledger"];

describe("activity surface stays app-agnostic", () => {
  for (const file of SURFACE) {
    it(`${file} names no app, vendor, or plugin`, () => {
      const text = readFileSync(join(__dirname, file), "utf8").toLowerCase();
      const hits = FORBIDDEN.filter((name) => text.includes(name));
      expect(hits).toEqual([]);
    });
  }
});
