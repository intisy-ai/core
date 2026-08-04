import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { setActivityContext, resetActivityContext, buildOrigin } from "./activity-context.js";
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
