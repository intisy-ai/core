import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getActivityContext, resetActivityContext, setActivityContext } from "./activity-context.js";
import { createActivityService } from "./activity-service.js";
import type { ActivitySpec } from "./activity.types.js";

afterEach(() => {
  resetActivityContext();
});

describe("createActivityService", () => {
  // A free-text message belongs in details.message, which becomes the record's
  // rendered `text` when the topic has no registered renderer, as here.
  it("records an emitted activity and reads it back", async () => {
    const dir = mkdtempSync(join(tmpdir(), "core-activity-"));
    const service = createActivityService(dir);
    service.emit({
      topic: "demo.activated",
      action: "activated",
      actor: "system",
      subject: { kind: "plugin", id: "demo" },
      details: { message: "activated demo" },
    });
    const records = await service.read({ limit: 10 });
    expect(records.some((record) => record.text === "activated demo")).toBe(true);
  });

  it("restores the ambient activity context after emitting", () => {
    const dir = mkdtempSync(join(tmpdir(), "core-activity-"));
    const service = createActivityService(dir);
    setActivityContext({ app: "some-host", entry: "sidecar" });
    const before = getActivityContext();

    service.emit({ topic: "demo.activated", action: "activated" });

    expect(getActivityContext()).toEqual(before);
  });

  it("restores the ambient activity context even when emit throws", () => {
    const dir = mkdtempSync(join(tmpdir(), "core-activity-"));
    const service = createActivityService(dir);
    setActivityContext({ app: "some-host", entry: "sidecar" });
    const before = getActivityContext();

    expect(() => service.emit(null as unknown as ActivitySpec)).toThrow();

    expect(getActivityContext()).toEqual(before);
  });
});
