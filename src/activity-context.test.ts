import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { setActivityContext, resetActivityContext, buildOrigin, withCause } from "./activity-context.js";
import { emitEvent, readActivity } from "./activity.js";

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "activity-ctx-"));
  process.env.HUB_CONFIG_DIR = home;
  return home;
}

describe("ambient activity context", () => {
  beforeEach(() => { resetActivityContext(); tempHome(); });

  it("stamps origin on every emitted record without changing the call site", () => {
    const home = process.env.HUB_CONFIG_DIR as string;
    setActivityContext({ app: "test-app", entry: "handler" });
    emitEvent({ topic: "plugin.installed", action: "installed", subject: { kind: "plugin", id: "x" } }, "some-plugin");

    const { records } = readActivity([home]);
    expect(records).toHaveLength(1);
    expect(records[0].origin.app).toBe("test-app");
    expect(records[0].origin.entry).toBe("handler");
    expect(records[0].origin.home).toBe(home);
    expect(typeof records[0].origin.pid).toBe("number");
  });

  it("marks origin.app standalone when no app context is resolvable", () => {
    delete process.env.CORE_APP;
    const origin = buildOrigin();
    expect(origin.app).toBe("standalone");
  });
});

describe("cause scoping", () => {
  beforeEach(() => { resetActivityContext(); tempHome(); });

  it("gives every event in a scope one trace, and chains later events to the first", () => {
    const home = process.env.HUB_CONFIG_DIR as string;
    withCause({ kind: "user", surface: "Plugins tab > Update" }, () => {
      emitEvent({ topic: "plugin.installed", action: "updated", subject: { kind: "plugin", id: "a" } }, "updater");
      emitEvent({ topic: "proxy.status", action: "started" }, "loader");
    });

    const { records } = readActivity([home]);
    expect(records).toHaveLength(2);
    const [second, first] = records; // newest first
    expect(first.cause.kind).toBe("user");
    expect(first.cause.surface).toBe("Plugins tab > Update");
    expect(second.trace.id).toBe(first.trace.id);
    expect(first.trace.causedBy).toBeUndefined();
    expect(second.trace.causedBy).toBe(first.id);
  });

  it("keeps the scope across an await", async () => {
    const home = process.env.HUB_CONFIG_DIR as string;
    await withCause({ kind: "schedule" }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      emitEvent({ topic: "sync.completed", action: "sync_completed" }, "sync");
    });
    const { records } = readActivity([home]);
    expect(records[0].cause.kind).toBe("schedule");
  });

  it("inherits the trace in a nested scope and chains it to the outer root", () => {
    const home = process.env.HUB_CONFIG_DIR as string;
    withCause({ kind: "user", surface: "outer" }, () => {
      emitEvent({ topic: "plugin.installed", action: "installed" }, "outer-src");
      withCause({ kind: "cascade", surface: "inner" }, () => {
        emitEvent({ topic: "proxy.status", action: "started" }, "inner-src");
      });
    });
    const { records } = readActivity([home]);
    const inner = records.find((r: any) => r.source === "inner-src")!;
    const outer = records.find((r: any) => r.source === "outer-src")!;
    expect(inner.trace.id).toBe(outer.trace.id);
    expect(inner.cause.kind).toBe("cascade");
    expect(inner.trace.causedBy).toBe(outer.id);
  });

  it("defaults to an unknown cause outside any scope, one trace per event", () => {
    const home = process.env.HUB_CONFIG_DIR as string;
    emitEvent({ topic: "sync.completed", action: "sync_completed" }, "s");
    emitEvent({ topic: "sync.completed", action: "sync_completed" }, "s");
    const { records } = readActivity([home]);
    expect(records[0].cause.kind).toBe("unknown");
    expect(records[0].trace.id).not.toBe(records[1].trace.id);
  });
});
