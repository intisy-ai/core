import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// A test-only seam mirroring the one in configcli.test.ts: emitEvent delegates to
// the real implementation unless a test flips throwOnEmit, and every call is
// recorded so a test can assert exactly what the factory's emit forwarded. The
// real path still runs (rather than replacing emitEvent outright) so a home is
// required below: an emit with no home would otherwise fall through to whatever
// getAppConfigDir() resolves to outside a test home.
const activityMock = vi.hoisted(() => ({ calls: [] as unknown[][], throwOnEmit: false }));

vi.mock("./activity.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./activity.js")>();
  return {
    ...actual,
    emitEvent: (...args: Parameters<typeof actual.emitEvent>) => {
      activityMock.calls.push(args);
      if (activityMock.throwOnEmit) throw new Error("emit boom");
      return actual.emitEvent(...args);
    },
  };
});

import { createActivitySeam } from "./activity-seam.js";
import { withCause, activityEnv } from "./activity-context.js";

describe("createActivitySeam", () => {
  beforeEach(() => {
    activityMock.calls = [];
    activityMock.throwOnEmit = false;
    process.env.HUB_CONFIG_DIR = mkdtempSync(join(tmpdir(), "activity-seam-"));
  });

  it("forwards emit to emitEvent with the given source", () => {
    const seam = createActivitySeam("my-source");
    const spec = { topic: "sync.completed", action: "sync_completed" };
    seam.emit(spec as any);
    expect(activityMock.calls).toEqual([[spec, "my-source"]]);
  });

  it("swallows a throwing emit instead of letting it escape to the caller", () => {
    activityMock.throwOnEmit = true;
    const seam = createActivitySeam("my-source");
    expect(() => seam.emit({ topic: "x", action: "y" } as any)).not.toThrow();
  });

  it("exposes the real scope and env functions unwrapped", () => {
    const seam = createActivitySeam("my-source");
    expect(seam.scope).toBe(withCause);
    expect(seam.env).toBe(activityEnv);
  });
});
