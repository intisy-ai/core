import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { flattenScreen, screenLayoutFor, CONTAINER_KINDS } from "../screen-layout.js";

const fixture = JSON.parse(readFileSync(join(__dirname, "fixtures", "screen-fixture.json"), "utf8"));

describe("flattenScreen", () => {
  it("drops containers and keeps leaves in document order", () => {
    expect(flattenScreen(fixture.layout).map((row) => row.kind)).toEqual(["stats", "table", "chips", "text", "text"]);
  });

  it("labels a tab's rows with the tab, and a card's rows with its title", () => {
    const rows = flattenScreen(fixture.layout);
    expect(rows[1].label).toBe("Changes / Pending");
    expect(rows[2].label).toBe("Profiles");
    expect(rows[0].label).toBeUndefined();
  });

  it("reports nesting depth so a surface can indent", () => {
    expect(flattenScreen(fixture.layout).map((row) => row.depth)).toEqual([0, 2, 1, 1, 1]);
  });

  it("treats an unknown kind as a leaf rather than dropping it", () => {
    expect(flattenScreen({ kind: "stack", children: [{ kind: "sparkline", source: "s" }] })).toHaveLength(1);
  });

  it("prefers a declared tui surface, and falls back to the layout", () => {
    const spec = { ...fixture, surfaces: { tui: { kind: "text", text: "terminal" } } };
    expect(screenLayoutFor(spec, "tui").text).toBe("terminal");
    expect(screenLayoutFor(spec, "gui").kind).toBe("stack");
    expect(screenLayoutFor(fixture, "tui").kind).toBe("stack");
  });

  it("names every container kind it collapses", () => {
    expect([...CONTAINER_KINDS].sort()).toEqual(["card", "grid", "group", "row", "stack", "tabs"]);
  });
});
