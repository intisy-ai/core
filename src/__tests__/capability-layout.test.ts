import { describe, it, expect } from "vitest";
import { resolveLayout, sectionById } from "../capability-layout.js";
import type { CapabilitySchema } from "../capabilities.types.js";

const SCHEMA: CapabilitySchema = {
  fields: [
    { key: "logging", type: "boolean", label: "Logging" },
    { key: "enabled", type: "boolean", label: "Sync enabled" },
    { key: "categories.accounts", type: "boolean", label: "Accounts" },
    { key: "debounce_seconds", type: "number", label: "Debounce" },
  ],
  actions: [
    { id: "sync", label: "Sync now" },
    { id: "purge", label: "Purge", danger: true },
  ],
  sections: [
    { id: "sync", label: "Sync", order: 40, fields: ["enabled", "categories.accounts"], actions: ["sync"] },
  ],
};

describe("resolveLayout", () => {
  it("resolves a section's referenced fields and actions in declared order", () => {
    const { sections } = resolveLayout("sync-bridge", SCHEMA);
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ id: "sync", label: "Sync", order: 40, plugin: "sync-bridge" });
    expect(sections[0].fields.map((f) => f.key)).toEqual(["enabled", "categories.accounts"]);
    expect(sections[0].actions.map((a) => a.id)).toEqual(["sync"]);
  });

  it("leaves everything a section did not claim as the plugin's own settings", () => {
    const { fields, actions } = resolveLayout("sync-bridge", SCHEMA);
    expect(fields.map((f) => f.key)).toEqual(["logging", "debounce_seconds"]);
    expect(actions.map((a) => a.id)).toEqual(["purge"]);
  });

  it("returns everything as leftovers when no section is declared", () => {
    const { sections, fields, actions } = resolveLayout("plain", { fields: SCHEMA.fields, actions: SCHEMA.actions });
    expect(sections).toEqual([]);
    expect(fields).toHaveLength(4);
    expect(actions).toHaveLength(2);
  });

  it("ignores references to fields and actions the plugin never declared", () => {
    const { sections } = resolveLayout("p", {
      fields: [{ key: "real", type: "string" }],
      sections: [{ id: "s", label: "S", fields: ["real", "imaginary"], actions: ["ghost"] }],
    });
    expect(sections[0].fields.map((f) => f.key)).toEqual(["real"]);
    expect(sections[0].actions).toEqual([]);
  });

  it("drops a section that resolves to nothing rather than rendering an empty card", () => {
    const { sections } = resolveLayout("p", {
      fields: [{ key: "real", type: "string" }],
      sections: [{ id: "empty", label: "Empty", fields: ["imaginary"] }],
    });
    expect(sections).toEqual([]);
  });

  it("gives a field to the first section that claims it, never to two", () => {
    const { sections, fields } = resolveLayout("p", {
      fields: [{ key: "shared", type: "boolean" }],
      sections: [
        { id: "first", label: "First", order: 1, fields: ["shared"] },
        { id: "second", label: "Second", order: 2, fields: ["shared"] },
      ],
    });
    expect(sections.map((s) => s.id)).toEqual(["first"]);
    expect(fields).toEqual([]);
  });

  it("orders sections by order then label, with undeclared order last", () => {
    const { sections } = resolveLayout("p", {
      fields: [{ key: "a", type: "string" }, { key: "b", type: "string" }, { key: "c", type: "string" }],
      sections: [
        { id: "late", label: "Zed", fields: ["a"] },
        { id: "mid", label: "Mid", order: 10, fields: ["b"] },
        { id: "early", label: "Early", order: 1, fields: ["c"] },
      ],
    });
    expect(sections.map((s) => s.id)).toEqual(["early", "mid", "late"]);
  });

  it("does not carry the raw key lists into the resolved section", () => {
    const [section] = resolveLayout("sync-bridge", SCHEMA).sections;
    expect(section.fields.every((f) => typeof f === "object")).toBe(true);
    expect(section.actions.every((a) => typeof a === "object")).toBe(true);
  });
});

describe("sectionById", () => {
  it("finds a resolved section by its declared id", () => {
    expect(sectionById("sync-bridge", SCHEMA, "sync")?.label).toBe("Sync");
  });

  it("returns null for an id the plugin never declared", () => {
    expect(sectionById("sync-bridge", SCHEMA, "nope")).toBeNull();
  });
});
