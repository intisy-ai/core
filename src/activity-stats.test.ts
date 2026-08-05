import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { activityStats } from "./activity-stats.js";
import type { ActivityStats } from "./activity.types.js";

let home: string;
let other: string;

function seedSegment(dir: string, name: string, lines: string[]): void {
  mkdirSync(join(dir, "events"), { recursive: true });
  writeFileSync(join(dir, "events", name), lines.map((l) => l + "\n").join(""), "utf8");
}

function envelope(ts: number): string {
  return JSON.stringify({ v: 1, id: "src-" + ts, ts, topic: "notification", source: "t", payload: {} });
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "core-stats-a-"));
  other = mkdtempSync(join(tmpdir(), "core-stats-b-"));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(other, { recursive: true, force: true });
});

describe("activityStats", () => {
  it("sums size and segments across homes and reports the oldest event", () => {
    seedSegment(home, "bus.jsonl", [envelope(3000)]);
    seedSegment(home, "bus.1.jsonl", [envelope(1000), envelope(2000)]);
    seedSegment(other, "bus.jsonl", [envelope(5000)]);

    const stats: ActivityStats = activityStats([home, other]);

    expect(stats.segments).toBe(3);
    expect(stats.bytes).toBeGreaterThan(0);
    expect(stats.oldestTs).toBe(1000);
    const byHome = Object.fromEntries(stats.homes.map((h) => [h.home, h]));
    expect(byHome[home].segments).toBe(2);
    expect(byHome[other].oldestTs).toBe(5000);
  });

  it("counts only segments that exist, so an unused home reports zeros", () => {
    const stats: ActivityStats = activityStats([home]);
    expect(stats).toMatchObject({ bytes: 0, segments: 0 });
    expect(stats.oldestTs).toBeUndefined();
    expect(stats.homes[0].home).toBe(home);
  });

  it("survives a corrupt oldest segment by reporting size without a timestamp", () => {
    seedSegment(home, "bus.jsonl", ["{not json"]);
    const stats: ActivityStats = activityStats([home]);
    expect(stats.segments).toBe(1);
    expect(stats.bytes).toBeGreaterThan(0);
    expect(stats.oldestTs).toBeUndefined();
  });

  it("reads the oldest event from the oldest segment, not the live log", () => {
    seedSegment(home, "bus.jsonl", [envelope(9000)]);
    seedSegment(home, "bus.2.jsonl", [envelope(4000)]);
    seedSegment(home, "bus.1.jsonl", [envelope(1500)]);

    const stats: ActivityStats = activityStats([home]);
    expect(stats.segments).toBe(3);
    expect(stats.oldestTs).toBe(1500);
  });

  it("returns empty totals for no homes and never throws on a bad argument", () => {
    expect(activityStats([])).toEqual({ homes: [], bytes: 0, segments: 0 });
    expect(() => activityStats(undefined as unknown as string[])).not.toThrow();
  });
});
