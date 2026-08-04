import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { emitEvent, normalizeActivity } from "./activity.js";

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
