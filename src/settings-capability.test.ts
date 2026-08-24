import { describe, expect, it } from "vitest";
import { defineCapabilities } from "./capabilities.js";
import { createSettingsCapability } from "./settings-capability.js";

describe("createSettingsCapability", () => {
  it("answers with what the plugin declared", async () => {
    defineCapabilities("settings-cap", {
      fields: [{ key: "apiKey", type: "secret", label: "API key" }],
      actions: [{ id: "sync", label: "Sync now" }],
    });
    const capability = createSettingsCapability("settings-cap", async () => ({ ok: true }));
    expect(await capability.schema()).toEqual({
      fields: [{ key: "apiKey", type: "secret", label: "API key" }],
      actions: [{ id: "sync", label: "Sync now" }],
    });
  });

  it("answers with an empty schema for a plugin that declared nothing", async () => {
    const capability = createSettingsCapability("settings-cap-empty", async () => ({ ok: true }));
    expect(await capability.schema()).toEqual({});
  });

  it("passes the action id and input to the runner", async () => {
    const seen: Array<[string, Record<string, unknown> | undefined]> = [];
    const capability = createSettingsCapability("settings-cap-run", async (actionId, input) => {
      seen.push([actionId, input]);
      return { ok: true, message: "done" };
    });
    expect(await capability.run("sync", { force: true })).toEqual({ ok: true, message: "done" });
    expect(seen).toEqual([["sync", { force: true }]]);
  });

  it("reports a throwing action as a failed result rather than throwing at the host", async () => {
    const capability = createSettingsCapability("settings-cap-throw", () => {
      throw new Error("upstream refused");
    });
    expect(await capability.run("sync")).toEqual({ ok: false, message: "upstream refused" });
  });
});
