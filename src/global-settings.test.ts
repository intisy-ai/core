import { describe, it, expect } from "vitest";
import { GLOBAL_SETTINGS_DEFAULTS, globalSettingsSchema, registerGlobalSettings } from "./global-settings.js";
import { getCapabilities } from "./capabilities.js";
import { getConfigDefaults } from "./config.js";

describe("global settings", () => {
  it("types every default key, so a UI never has to guess a widget", () => {
    const { defaults, fields } = globalSettingsSchema();
    const typed = new Set(fields.map((f: { key: string }) => f.key));
    for (const key of Object.keys(defaults)) {
      expect(typed.has(key), `${key} has no field spec`).toBe(true);
    }
    for (const field of fields) {
      expect(Object.keys(defaults)).toContain(field.key);
    }
  });

  it("offers the impact floor as a fixed choice, never free text", () => {
    const floor = globalSettingsSchema().fields.find((f: { key: string }) => f.key === "activityMinImpact");
    expect(floor?.type).toBe("select");
    expect(floor?.options?.map((o: { value: string }) => o.value)).toEqual(["debug", "info", "notice", "warning", "error"]);
  });

  it("describes the retention limits as unlimited when unset", () => {
    const { defaults, fields } = globalSettingsSchema();
    expect(defaults.activityMaxBytes).toBe(0);
    expect(defaults.activityMaxDays).toBe(0);
    for (const key of ["activityMaxBytes", "activityMaxDays"]) {
      const field = fields.find((f: { key: string }) => f.key === key);
      expect(field?.type).toBe("number");
      expect(field?.min).toBe(0);
      expect(String(field?.description ?? "")).toMatch(/unlimited/i);
    }
  });

  it("hands out copies, so a caller cannot mutate the declaration", () => {
    const first = globalSettingsSchema();
    first.defaults.activityMinImpact = "error";
    (first.fields[0] as { key: string }).key = "tampered";
    const second = globalSettingsSchema();
    expect(second.defaults.activityMinImpact).toBe("info");
    expect(second.fields[0].key).not.toBe("tampered");
  });

  it("registers defaults and fields under the reserved settings name", () => {
    registerGlobalSettings();
    expect(getConfigDefaults("settings")).toMatchObject(GLOBAL_SETTINGS_DEFAULTS);
    expect(getCapabilities("settings").fields?.length).toBe(Object.keys(GLOBAL_SETTINGS_DEFAULTS).length);
  });

  it("names no app, plugin, or vendor", () => {
    const text = JSON.stringify(globalSettingsSchema()).toLowerCase();
    for (const word of ["claude", "opencode", "cairn", "anthropic", "gemini", "antigravity", "wakatime"]) {
      expect(text).not.toContain(word);
    }
  });
});
