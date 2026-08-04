import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { emitEvent, normalizeActivity, readActivity } from "./activity.js";
import { drain } from "./bus.js";

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "activity-"));
  process.env.HUB_CONFIG_DIR = home;
  return home;
}

describe("emitEvent", () => {
  beforeEach(() => { tempHome(); });

  it("writes a normalized activity payload under the given topic", () => {
    const env = emitEvent(
      { topic: "plugin.installed", action: "installed", subject: { kind: "plugin", id: "wakatime", label: "WakaTime" }, details: { version: "1.2.3" } },
      "plugin-updater",
    );
    expect(env).not.toBeNull();
    expect(env!.topic).toBe("plugin.installed");
    expect(env!.payload).toMatchObject({
      action: "installed",
      actor: "system",
      impact: "notice",
      subject: { kind: "plugin", id: "wakatime", label: "WakaTime" },
      details: { version: "1.2.3" },
    });
  });
});

describe("normalizeActivity", () => {
  it("normalizes a raw notification (no action) using topic defaults + level mapping", () => {
    const rec = normalizeActivity({ v: 1, id: "x", ts: 10, topic: "notification", source: "core-proxy", payload: { message: "hi", level: "warning" } });
    expect(rec.action).toBe("notified");
    expect(rec.impact).toBe("warning");
    expect(rec.actor).toBe("system");
    expect(rec.text).toBe("hi");
  });

  it("uses the registered renderer for an emitEvent payload", () => {
    const rec = normalizeActivity({ v: 1, id: "y", ts: 11, topic: "plugin.installed", source: "plugin-updater", payload: { action: "installed", impact: "notice", actor: "system", subject: { kind: "plugin", label: "WakaTime" }, details: { version: "1.2.3" } } });
    expect(rec.text).toBe("Installed WakaTime 1.2.3");
  });

  it("falls back to a generic template for an unregistered topic/action", () => {
    const rec = normalizeActivity({ v: 1, id: "z", ts: 12, topic: "custom.thing", source: "myplugin", payload: { action: "frobbed", subject: { kind: "widget", label: "W1" } } });
    expect(rec.text).toBe("myplugin frobbed W1");
    expect(rec.impact).toBe("info");
  });
});

describe("readActivity", () => {
  it("reads normalized records newest-first, filters by impact, and does NOT advance drain cursors", () => {
    const home = tempHome();
    emitEvent({ topic: "plugin.installed", action: "installed", subject: { kind: "plugin", label: "A" }, details: { version: "1" } }, "plugin-updater");
    emitEvent({ topic: "notification", action: "notified", impact: "error", details: { message: "boom" } }, "core-proxy");

    const all = readActivity([home]);
    expect(all.records.map((r: any) => r.source)).toEqual(["core-proxy", "plugin-updater"]); // newest first

    const errorsOnly = readActivity([home], { impacts: ["error"] });
    expect(errorsOnly.records).toHaveLength(1);
    expect(errorsOnly.records[0].text).toBe("boom");

    // Non-consumption: a fresh drain still sees BOTH events.
    let drained = 0;
    drain("some-consumer", () => { drained += 1; });
    expect(drained).toBe(2);
  });

  it("paginates with an opaque cursor", () => {
    const home = tempHome();
    for (let i = 0; i < 5; i++) emitEvent({ topic: "notification", action: "notified", details: { message: "m" + i } }, "s");
    const page1 = readActivity([home], { limit: 2 });
    expect(page1.records).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = readActivity([home], { limit: 2, cursor: page1.nextCursor });
    expect(page2.records).toHaveLength(2);
    expect(page2.records[0].id).not.toBe(page1.records[0].id);
  });
});
