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
    const service = createActivityService(dir, "demo");
    service.emit({
      topic: "demo.activated",
      action: "activated",
      actor: "system",
      subject: { kind: "plugin", id: "demo" },
      details: { message: "activated demo" },
    });
    const page = await service.read({ limit: 10 });
    expect(page.records.some((record) => record.text === "activated demo")).toBe(true);
  });

  it("attributes what it records to its own source", async () => {
    const dir = mkdtempSync(join(tmpdir(), "core-activity-"));
    const service = createActivityService(dir, "wakatime-sync");
    service.emit({ topic: "demo.activated", action: "activated" });

    const page = await service.read({ sources: ["wakatime-sync"], limit: 10 });
    expect(page.records).toHaveLength(1);
    expect(page.records[0].source).toBe("wakatime-sync");
  });

  it("pages, returning the cursor the next read takes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "core-activity-"));
    const service = createActivityService(dir, "demo");
    for (let index = 0; index < 3; index++) {
      service.emit({ topic: "demo.activated", action: `activated-${index}` });
    }

    const first = await service.read({ limit: 2 });
    expect(first.records).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();

    const second = await service.read({ limit: 2, cursor: first.nextCursor });
    expect(second.records).toHaveLength(1);
    expect(second.nextCursor).toBeUndefined();
  });

  it("restores the ambient activity context after emitting", () => {
    const dir = mkdtempSync(join(tmpdir(), "core-activity-"));
    const service = createActivityService(dir, "demo");
    setActivityContext({ app: "some-host", entry: "sidecar" });
    const before = getActivityContext();

    service.emit({ topic: "demo.activated", action: "activated" });

    expect(getActivityContext()).toEqual(before);
  });

  it("restores the ambient activity context even when emit throws", () => {
    const dir = mkdtempSync(join(tmpdir(), "core-activity-"));
    const service = createActivityService(dir, "demo");
    setActivityContext({ app: "some-host", entry: "sidecar" });
    const before = getActivityContext();

    expect(() => service.emit(null as unknown as ActivitySpec)).toThrow();

    expect(getActivityContext()).toEqual(before);
  });
});
