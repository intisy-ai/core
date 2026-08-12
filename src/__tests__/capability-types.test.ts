import { describe, expect, it } from "vitest";
import { defineCapabilities, getCapabilities } from "../capabilities.js";

describe("capability declarations", () => {
  it("keeps an action's declared metadata", () => {
    defineCapabilities("args-test", {
      actions: [{ id: "sync", label: "Sync now", description: "Push heartbeats", confirm: "Sync?", danger: true }],
    });
    expect(getCapabilities("args-test").actions).toEqual([
      { id: "sync", label: "Sync now", description: "Push heartbeats", confirm: "Sync?", danger: true },
    ]);
  });

  it("drops an action's args, which no surface renders", () => {
    defineCapabilities("args-drop-test", {
      actions: [{ id: "restore", label: "Restore", args: [{ key: "id", type: "string" }] } as never],
    });
    const [action] = getCapabilities("args-drop-test").actions ?? [];
    expect(action).toEqual({ id: "restore", label: "Restore" });
    expect(action).not.toHaveProperty("args");
  });

  it("carries a screen's per-surface override through unchanged", () => {
    defineCapabilities("surface-test", {
      screens: [{
        id: "history",
        label: "History",
        layout: { kind: "stack", children: [{ kind: "table", source: "rows" }] },
        surfaces: { tui: { kind: "stack", children: [{ kind: "text", source: "summary" }] } },
      }],
    });
    const [screen] = getCapabilities("surface-test").screens ?? [];
    expect(screen.surfaces).toEqual({ tui: { kind: "stack", children: [{ kind: "text", source: "summary" }] } });
  });
});
