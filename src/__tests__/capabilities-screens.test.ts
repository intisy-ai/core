import { describe, it, expect } from "vitest";
import { defineCapabilities, getCapabilities } from "../capabilities.js";

function deepTree(depth: number): { kind: string; children: unknown[] } {
  let node = { kind: "text", children: [] as unknown[] };
  for (let i = 0; i < depth; i++) node = { kind: "stack", children: [node] };
  return node;
}

describe("screen declarations", () => {
  it("keeps a well-formed screen and its nested children", () => {
    defineCapabilities("p-keep", {
      screens: [{
        id: "config", label: "Config", glyph: "C", order: 40, refreshOn: ["config."],
        layout: { kind: "stack", children: [{ kind: "table", source: "rows", columns: [{ key: "file" }] }] },
      }],
    });
    const [screen] = getCapabilities("p-keep").screens;
    expect(screen.id).toBe("config");
    expect(screen.refreshOn).toEqual(["config."]);
    expect(screen.layout.children[0].kind).toBe("table");
    expect(screen.layout.children[0].source).toBe("rows");
  });

  it("drops a screen with no id, label, or layout", () => {
    defineCapabilities("p-drop", {
      screens: [
        { label: "No id", layout: { kind: "stack" } },
        { id: "no-label", layout: { kind: "stack" } },
        { id: "no-layout", label: "No layout" },
      ],
    });
    expect(getCapabilities("p-drop").screens).toBeUndefined();
  });

  it("drops a node with no kind and truncates past the depth bound", () => {
    defineCapabilities("p-bad", {
      screens: [{ id: "s", label: "S", layout: { kind: "stack", children: [{ source: "x" }, deepTree(40)] } }],
    });
    const [screen] = getCapabilities("p-bad").screens;
    expect(screen.layout.children).toHaveLength(1);
    let depth = 0;
    for (let node = screen.layout; node.children && node.children.length; node = node.children[0]) depth++;
    expect(depth).toBeLessThanOrEqual(12);
  });

  it("dedupes by id with the latest declaration winning", () => {
    defineCapabilities("p-dupe", { screens: [{ id: "s", label: "First", layout: { kind: "stack" } }] });
    defineCapabilities("p-dupe", { screens: [{ id: "s", label: "Second", layout: { kind: "stack" } }] });
    const { screens } = getCapabilities("p-dupe");
    expect(screens).toHaveLength(1);
    expect(screens[0].label).toBe("Second");
  });

  it("returns a copy, so a caller cannot mutate the registry", () => {
    defineCapabilities("p-copy", { screens: [{ id: "s", label: "S", layout: { kind: "stack", children: [{ kind: "text" }] } }] });
    getCapabilities("p-copy").screens[0].layout.children.push({ kind: "text" });
    expect(getCapabilities("p-copy").screens[0].layout.children).toHaveLength(1);
  });

  it("strips a screen's own unlisted properties, while a node's open vocabulary keeps them", () => {
    defineCapabilities("p-strip", {
      screens: [{
        id: "s", label: "S", href: "https://example",
        layout: { kind: "stack", href: "https://example" },
      }],
    });
    const [screen] = getCapabilities("p-strip").screens;
    expect(screen).not.toHaveProperty("href");
    expect(screen.layout.href).toBe("https://example");
  });
});
