import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { emitEvent, normalizeActivity, readActivity } from "./activity.js";
import { drain } from "./bus.js";
import { makeWriteLog } from "./log.js";
import { setConfigValue } from "./config.js";
import { describeChange } from "./activity-redact.js";

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

  it("redacts secret changes even when the caller passes raw values, proving it cannot be bypassed", () => {
    const home = tempHome();
    emitEvent(
      { topic: "config.changed", action: "config_changed", changes: [describeChange("token", "a", "b"), describeChange("logConsole", false, true)] },
      "myplugin",
    );
    // Read back through readActivity (JSONL write -> parse -> normalizeActivity),
    // not the in-memory envelope emitEvent returned, so this proves the PERSISTED
    // record is redacted rather than just the object still held in this process.
    const { records } = readActivity([home], { topics: ["config.changed"] });
    expect(records).toHaveLength(1);
    const changes = records[0].changes as any[];
    const token = changes.find((c: any) => c.key === "token");
    const logConsole = changes.find((c: any) => c.key === "logConsole");
    expect(token.redacted).toBe(true);
    expect(token.from).toBeUndefined();
    expect(token.to).toBeUndefined();
    expect(logConsole.redacted).toBeUndefined();
    expect(logConsole.from).toBe(false);
    expect(logConsole.to).toBe(true);
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

describe("error-activity hook", () => {
  it("mirrors error-level log writes onto the activity bus as an error record", () => {
    const home = tempHome();
    const writeLog = makeWriteLog("myplugin", home);
    writeLog("something broke", true);   // isError = true
    writeLog("just info", false);        // must NOT emit

    const errs = readActivity([home], { impacts: ["error"] });
    expect(errs.records).toHaveLength(1);
    expect(errs.records[0].source).toBe("myplugin");
    expect(errs.records[0].text.toLowerCase()).toContain("something broke");
  });
});

describe("config.changed instrumentation", () => {
  it("emits a config_changed activity when a config value is written", () => {
    const home = tempHome();
    setConfigValue("myplugin", "logging", false, home);
    const recs = readActivity([home], { topics: ["config.changed"] });
    expect(recs.records).toHaveLength(1);
    expect(recs.records[0].subject?.id).toBe("myplugin");
    expect(recs.records[0].actor).toBe("user");
  });
});
