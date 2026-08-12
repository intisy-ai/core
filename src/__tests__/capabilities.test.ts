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

describe("legacy menu field", () => {
  it("ignores a declared menu, since screens supersede it", () => {
    defineCapabilities("cap-menu-legacy", { menu: { label: "Updates", glyph: "@", order: 5 } } as unknown as CapabilitySchema);
    expect(getCapabilities("cap-menu-legacy")).toEqual({});
  });
});

describe("section declaration", () => {
  it("carries a declared section back out", () => {
    defineCapabilities("cap-section", {
      sections: [{ id: "sync", label: "Sync", description: "Mirror across apps.", order: 40, scope: "allHomes", fields: ["enabled"], actions: ["run"] }],
    });
    expect(getCapabilities("cap-section").sections).toEqual([
      { id: "sync", label: "Sync", description: "Mirror across apps.", order: 40, scope: "allHomes", fields: ["enabled"], actions: ["run"] },
    ]);
  });

  it("drops a section with no id or no label, and non-string member references", () => {
    defineCapabilities("cap-section-bad", {
      sections: [
        { label: "No id" },
        { id: "no-label" },
        { id: "ok", label: "Ok", fields: ["good", "", 7, null], scope: "elsewhere" },
      ],
    } as unknown as CapabilitySchema);
    expect(getCapabilities("cap-section-bad").sections).toEqual([{ id: "ok", label: "Ok", fields: ["good"] }]);
  });

  it("dedupes sections by id across calls, latest winning", () => {
    defineCapabilities("cap-section-merge", { sections: [{ id: "a", label: "First" }, { id: "b", label: "Bee" }] });
    defineCapabilities("cap-section-merge", { sections: [{ id: "a", label: "Second", order: 1 }] });
    expect(getCapabilities("cap-section-merge").sections).toEqual([
      { id: "a", label: "Second", order: 1 },
      { id: "b", label: "Bee" },
    ]);
  });

  it("hands out copies of a section's member lists", () => {
    defineCapabilities("cap-section-copy", { sections: [{ id: "s", label: "S", fields: ["k"] }] });
    getCapabilities("cap-section-copy").sections![0].fields!.push("mutated");
    expect(getCapabilities("cap-section-copy").sections![0].fields).toEqual(["k"]);
  });
});

// Where a plugin keeps state, so a surface can offer to delete it on uninstall. A declared
// path names something the plugin owns; anything reaching outside the home does not.
describe("data declaration", () => {
  it("carries declared paths back out, merging across calls without repeating one", () => {
    defineCapabilities("cap-data", { data: { paths: ["state/thing.db"] } });
    defineCapabilities("cap-data", { data: { paths: ["state/thing.db", "state/other"] } });
    expect(getCapabilities("cap-data").data).toEqual({ paths: ["state/thing.db", "state/other"] });
  });

  it("drops a path that escapes the home, so a plugin cannot offer someone else's data", () => {
    defineCapabilities("cap-data-escape", {
      data: { paths: ["../../etc/passwd", "/etc/passwd", "C:\\Windows", "state\\..\\..\\out", "kept/file"] },
    });
    expect(getCapabilities("cap-data-escape").data).toEqual({ paths: ["kept/file"] });
  });

  it("declares nothing for a plugin that gave no usable path", () => {
    defineCapabilities("cap-data-empty", { data: { paths: ["..", ""] } });
    expect(getCapabilities("cap-data-empty").data).toBeUndefined();
  });

  it("hands out a copy of the path list", () => {
    defineCapabilities("cap-data-copy", { data: { paths: ["a"] } });
    getCapabilities("cap-data-copy").data!.paths!.push("mutated");
    expect(getCapabilities("cap-data-copy").data).toEqual({ paths: ["a"] });
  });
});
