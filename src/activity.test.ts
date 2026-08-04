import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync, appendFileSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { emitEvent, normalizeActivity, readActivity, setActivityEnabled } from "./activity.js";
import { drain } from "./bus.js";
import { makeWriteLog } from "./log.js";
import { setConfigValue } from "./config.js";
import { describeChange } from "./activity-redact.js";
import { withCause, setActivityContext, resetActivityContext } from "./activity-context.js";

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "activity-"));
  process.env.HUB_CONFIG_DIR = home;
  return home;
}

// Rotation is size-triggered and checked inside publish(), so padding the live log
// past the cap here just sets up the trigger; the next emitEvent call in the test
// is what actually causes the rotation.
function forceRotate(home: string): void {
  appendFileSync(join(home, "events", "bus.jsonl"), " ".repeat(1_000_001) + "\n");
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

  it("never persists a leaked secret nested inside an object-valued change", () => {
    const home = tempHome();
    emitEvent(
      { topic: "config.changed", action: "config_changed", changes: [describeChange("provider", { apiKey: "sk-LEAKED", nested: { token: "t-LEAKED" } }, {})] },
      "myplugin",
    );
    // Read back through readActivity (JSONL write -> parse -> normalizeActivity),
    // proving the persisted record on disk carries no secret text.
    const { records } = readActivity([home], { topics: ["config.changed"] });
    expect(records).toHaveLength(1);
    const change = (records[0].changes as any[])[0];
    expect(change.from).toBe("[object]");
    expect(change.to).toBe("[object]");
    expect(JSON.stringify(records[0])).not.toContain("sk-LEAKED");
    expect(JSON.stringify(records[0])).not.toContain("t-LEAKED");
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

  it("returns an empty page with no cursor for limit: 0, without throwing", () => {
    const home = tempHome();
    emitEvent({ topic: "notification", action: "notified", details: { message: "m" } }, "s");
    const page = readActivity([home], { limit: 0 });
    expect(page).toEqual({ records: [], nextCursor: undefined });
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

  it("reads across rotated segments and paginates past a segment boundary", () => {
    const home = tempHome();
    emitEvent({ topic: "sync.completed", action: "sync_completed", details: { n: 1 } }, "old");
    forceRotate(home); // the first record now lives in bus.1.jsonl
    emitEvent({ topic: "sync.completed", action: "sync_completed", details: { n: 2 } }, "new");

    const all = readActivity([home]);
    expect(all.records.map((r: any) => r.source)).toEqual(["new", "old"]);

    const page1 = readActivity([home], { limit: 1 });
    expect(page1.records.map((r: any) => r.source)).toEqual(["new"]);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = readActivity([home], { limit: 1, cursor: page1.nextCursor });
    expect(page2.records.map((r: any) => r.source)).toEqual(["old"]);
  });

  it("drops events below the configured minimum impact, and keeps the rest", () => {
    const home = tempHome();
    emitEvent({ topic: "sync.completed", action: "noise", impact: "debug" }, "s");
    emitEvent({ topic: "sync.completed", action: "real", impact: "notice" }, "s");
    expect(readActivity([home]).records.map((r: any) => r.action)).toEqual(["real"]);
  });

  it("records debug events when the gate is lowered", () => {
    const home = tempHome();
    mkdirSync(join(home, "config"), { recursive: true });
    writeFileSync(join(home, "config", "settings.json"), JSON.stringify({ activityMinImpact: "debug" }));
    emitEvent({ topic: "sync.completed", action: "noise", impact: "debug" }, "s");
    expect(readActivity([home]).records.map((r: any) => r.action)).toEqual(["noise"]);
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

describe("collectHomeRecords parsing", () => {
  it("skips malformed and incomplete lines when reading activity", () => {
    const home = tempHome();
    emitEvent({ topic: "sync.completed", action: "sync_completed" }, "good");
    const log = join(home, "events", "bus.jsonl");
    appendFileSync(log, "not json at all\n");
    appendFileSync(log, JSON.stringify({ v: 1, topic: "sync.completed" }) + "\n"); // no id/ts
    appendFileSync(log, JSON.stringify({ v: 2, id: "x", ts: 1, topic: "sync.completed" }) + "\n"); // wrong version

    const { records } = readActivity([home]);
    expect(records).toHaveLength(1);
    expect(records[0].source).toBe("good");
  });
});

describe("activity kill switch", () => {
  it("writes nothing while activity is disabled, including the error-log mirror", () => {
    const home = tempHome();
    setActivityEnabled(false);
    try {
      emitEvent({ topic: "sync.completed", action: "sync_completed" }, "s");
      makeWriteLog("some-plugin", home)("boom", true);
      expect(readActivity([home]).records).toHaveLength(0);
    } finally {
      setActivityEnabled(true);
    }
    emitEvent({ topic: "sync.completed", action: "sync_completed" }, "s");
    expect(readActivity([home]).records).toHaveLength(1);
  });

  it("honors CORE_ACTIVITY_OFF at load, disabling emission before any test can call setActivityEnabled", async () => {
    const home = tempHome();
    process.env.CORE_ACTIVITY_OFF = "1";
    try {
      vi.resetModules();
      const act = await import("./activity.js");
      act.emitEvent({ topic: "sync.completed", action: "sync_completed" }, "s");
      expect(act.readActivity([home]).records).toHaveLength(0);
    } finally {
      delete process.env.CORE_ACTIVITY_OFF;
    }
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

  it("records a config change with its before and after values", () => {
    const home = tempHome();
    setConfigValue("some-plugin", "logging", true, home);
    setConfigValue("some-plugin", "logging", false, home);

    const [latest] = readActivity([home]).records;
    expect(latest.topic).toBe("config.changed");
    expect(latest.changes).toEqual([{ key: "logging", from: true, to: false }]);
    expect(latest.target).toBeUndefined();
  });

  it("never records the value of a credential-bearing config key", () => {
    const home = tempHome();
    setConfigValue("some-plugin", "api_key", "waka_super_secret", home);

    const [rec] = readActivity([home]).records;
    expect(rec.changes).toEqual([{ key: "api_key", redacted: true }]);
    expect(JSON.stringify(rec)).not.toContain("waka_super_secret");
  });

  it("never records the value of an OAuth refresh-token field", () => {
    const home = tempHome();
    setConfigValue("some-provider", "accounts.0.refresh", "waka_refresh_secret", home);

    const [rec] = readActivity([home]).records;
    expect(rec.changes).toEqual([{ key: "accounts.0.refresh", redacted: true }]);
    expect(JSON.stringify(rec)).not.toContain("waka_refresh_secret");
  });

  it("marks a config write into another home as targeting that home", () => {
    const own = tempHome();
    const other = mkdtempSync(join(tmpdir(), "activity-other-"));
    setConfigValue("some-plugin", "logging", false, other);

    const mine = readActivity([own]).records;
    expect(mine).toHaveLength(1);
    expect(mine[0].target).toEqual({ home: other });
    expect(readActivity([other]).records).toHaveLength(0);
  });
});

it("gives an error logged inside a cause scope that cause and the emitting origin", () => {
  const home = tempHome();
  resetActivityContext();
  setActivityContext({ app: "test-app", entry: "cli" });
  try {
    withCause({ kind: "hook", surface: "app hook" }, () => {
      makeWriteLog("some-plugin", home)("boom", true);
    });
    const [rec] = readActivity([home]).records;
    expect(rec.topic).toBe("log.error");
    expect(rec.cause.kind).toBe("hook");
    expect(rec.cause.surface).toBe("app hook");
    expect(rec.origin.app).toBe("test-app");
    expect(rec.origin.entry).toBe("cli");
  } finally {
    resetActivityContext();
  }
});

it("renders an unregistered topic from its message before falling back to the generic text", () => {
  const home = tempHome();
  emitEvent({ topic: "loader.custom", action: "did_something", details: { message: "Deployed 3 commands" } }, "some-loader");
  emitEvent({ topic: "loader.custom", action: "did_something", subject: { kind: "thing", id: "abc" } }, "some-loader");

  const texts = readActivity([home]).records.map((r: any) => r.text);
  expect(texts).toContain("Deployed 3 commands");
  expect(texts).toContain("some-loader did_something abc");
});
