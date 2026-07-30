import { describe, it, expect } from "vitest";
import { defineCapabilities, getCapabilities } from "../capabilities.js";
import type { CapabilitySchema } from "../capabilities.types.js";

describe("defineCapabilities / getCapabilities", () => {
  it("returns {} for a plugin that never declared capabilities", () => {
    expect(getCapabilities("never-declared")).toEqual({});
  });

  it("stores declared fields and actions", () => {
    defineCapabilities("cap-basic", {
      fields: [{ key: "enabled", type: "boolean", label: "Enabled", group: "General" }],
      actions: [{ id: "ping", label: "Ping", confirm: "Send a ping?" }],
    });
    const caps = getCapabilities("cap-basic");
    expect(caps.fields).toEqual([{ key: "enabled", type: "boolean", label: "Enabled", group: "General" }]);
    expect(caps.actions).toEqual([{ id: "ping", label: "Ping", confirm: "Send a ping?" }]);
  });

  it("merges across calls, deduping fields by key and actions by id (latest wins)", () => {
    defineCapabilities("cap-merge", { fields: [{ key: "level", type: "number", min: 1 }] });
    defineCapabilities("cap-merge", {
      fields: [{ key: "level", type: "number", min: 1, max: 9 }, { key: "mode", type: "string" }],
      actions: [{ id: "run", label: "Run" }],
    });
    defineCapabilities("cap-merge", { actions: [{ id: "run", label: "Run now", danger: true }] });
    const caps = getCapabilities("cap-merge");
    expect(caps.fields).toEqual([
      { key: "level", type: "number", min: 1, max: 9 },
      { key: "mode", type: "string" },
    ]);
    expect(caps.actions).toEqual([{ id: "run", label: "Run now", danger: true }]);
  });

  it("drops malformed entries instead of throwing", () => {
    defineCapabilities("cap-bad", {
      fields: [
        { key: "", type: "boolean" },
        { key: "ok", type: "not-a-type" },
        { type: "string" },
        { key: "good", type: "select", options: [{ value: "a", label: "A" }, { bad: 1 }] },
      ],
      actions: [{ id: "", label: "x" }, { id: "y" }, { id: "z", label: "Z" }],
    } as unknown as CapabilitySchema);
    const caps = getCapabilities("cap-bad");
    expect(caps.fields).toEqual([{ key: "good", type: "select", options: [{ value: "a", label: "A" }] }]);
    expect(caps.actions).toEqual([{ id: "z", label: "Z" }]);
  });

  it("getCapabilities returns copies, not internal references", () => {
    defineCapabilities("cap-copy", { fields: [{ key: "k", type: "string" }] });
    const first = getCapabilities("cap-copy");
    first.fields![0].key = "mutated";
    expect(getCapabilities("cap-copy").fields).toEqual([{ key: "k", type: "string" }]);
  });
});
