import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createActivityService } from "./activity-service.js";

describe("createActivityService", () => {
  // ActivitySpec (activity.types.ts) requires `topic` + `action`, not the `summary`
  // field the plan's draft test used; there is no `summary` on ActivityRecord either.
  // A free-text message belongs in `details.message`, which normalizeActivity/
  // renderActivity promotes verbatim into the record's `text` when (as here) the
  // topic has no registered renderer, so asserting on `record.text` is the closest
  // real equivalent of the draft's intent.
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
});
