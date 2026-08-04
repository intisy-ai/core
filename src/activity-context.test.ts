import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { setActivityContext, resetActivityContext, buildOrigin, withCause, activityEnv } from "./activity-context.js";
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

  it("chains a nested scope's second event to its own first event, not the outer root", () => {
    const home = process.env.HUB_CONFIG_DIR as string;
    withCause({ kind: "user", surface: "outer" }, () => {
      emitEvent({ topic: "plugin.installed", action: "installed" }, "outer-src");
      withCause({ kind: "cascade", surface: "inner" }, () => {
        emitEvent({ topic: "proxy.status", action: "started" }, "inner-first");
        emitEvent({ topic: "proxy.status", action: "stopped" }, "inner-second");
      });
    });
    const { records } = readActivity([home]);
    const outer = records.find((r: any) => r.source === "outer-src")!;
    const innerFirst = records.find((r: any) => r.source === "inner-first")!;
    const innerSecond = records.find((r: any) => r.source === "inner-second")!;

    expect(innerFirst.trace.id).toBe(outer.trace.id);
    expect(innerSecond.trace.id).toBe(outer.trace.id);
    expect(innerFirst.trace.causedBy).toBe(outer.id);
    expect(innerSecond.trace.causedBy).toBe(innerFirst.id);
    expect(innerSecond.trace.causedBy).not.toBe(outer.id);
  });
});

describe("cross-process propagation", () => {
  beforeEach(() => { resetActivityContext(); tempHome(); });

  it("exports the current trace and cause for a child process", () => {
    withCause({ kind: "user", surface: "TUI > Update" }, () => {
      emitEvent({ topic: "plugin.installed", action: "installed" }, "p");
      const env = activityEnv();
      expect(env.HUB_ACTIVITY_TRACE).toBeTruthy();
      expect(JSON.parse(env.HUB_ACTIVITY_CAUSE).surface).toBe("TUI > Update");
      expect(env.HUB_ACTIVITY_PARENT).toBeTruthy();
    });
  });

  it("exports nothing outside a scope", () => {
    expect(activityEnv()).toEqual({});
  });

  it("passes down the inherited parent id to a grandchild before this process emits anything", async () => {
    process.env.HUB_ACTIVITY_TRACE = "trace-from-parent";
    process.env.HUB_ACTIVITY_CAUSE = JSON.stringify({ kind: "user", surface: "parent surface" });
    process.env.HUB_ACTIVITY_PARENT = "parent-event-id";
    try {
      vi.resetModules();
      const ctx = await import("./activity-context.js");
      // No emitEvent has happened in this process yet, so scope.rootId is still
      // null; activityEnv() must fall back to the inherited parentRoot, exactly
      // like currentTrace() does, so a grandchild still chains to the real root.
      const env = ctx.activityEnv();
      expect(env.HUB_ACTIVITY_PARENT).toBe("parent-event-id");
    } finally {
      delete process.env.HUB_ACTIVITY_TRACE;
      delete process.env.HUB_ACTIVITY_CAUSE;
      delete process.env.HUB_ACTIVITY_PARENT;
    }
  });

  it("adopts a trace and cause handed down through the environment", async () => {
    const home = tempHome();
    process.env.HUB_ACTIVITY_TRACE = "trace-from-parent";
    process.env.HUB_ACTIVITY_CAUSE = JSON.stringify({ kind: "user", surface: "parent surface" });
    process.env.HUB_ACTIVITY_PARENT = "parent-event-id";
    try {
      vi.resetModules();
      const ctx = await import("./activity-context.js");
      const act = await import("./activity.js");
      act.emitEvent({ topic: "sync.completed", action: "sync_completed" }, "child");
      const { records } = act.readActivity([home]);
      expect(records[0].trace.id).toBe("trace-from-parent");
      expect(records[0].trace.causedBy).toBe("parent-event-id");
      expect(records[0].cause.surface).toBe("parent surface");
      expect(typeof ctx.activityEnv).toBe("function");
    } finally {
      delete process.env.HUB_ACTIVITY_TRACE;
      delete process.env.HUB_ACTIVITY_CAUSE;
      delete process.env.HUB_ACTIVITY_PARENT;
    }
  });
});

describe("origin resolution", () => {
  beforeEach(() => { resetActivityContext(); tempHome(); });

  it("returns the same frozen origin object until something it depends on changes", () => {
    setActivityContext({ app: "test-app", entry: "handler" });
    const first = buildOrigin();
    expect(buildOrigin()).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);

    setActivityContext({ entry: "cli" });
    const afterEntry = buildOrigin();
    expect(afterEntry).not.toBe(first);
    expect(afterEntry.entry).toBe("cli");

    const other = tempHome();
    expect(buildOrigin().home).toBe(other);
  });

  it("writes an event into the home the context names, not the ambient one", () => {
    const ambient = process.env.HUB_CONFIG_DIR as string;
    const own = mkdtempSync(join(tmpdir(), "activity-own-"));
    setActivityContext({ app: "test-app", entry: "sidecar", home: own });

    emitEvent({ topic: "sync.completed", action: "sync_completed" }, "s");

    const mine = readActivity([own]).records;
    expect(mine).toHaveLength(1);
    expect(mine[0].origin.home).toBe(own);
    expect(readActivity([ambient]).records).toHaveLength(0);
  });
});
