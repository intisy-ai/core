import { describe, it, expect } from "vitest";
import {
  BUILTIN_ENGINES, CAPABILITY_PLUGINS, getEngines, getCapabilityPlugins, engineByCapability, engineById, isEngine,
} from "../engines.js";

describe("engine registry", () => {
  it("ships exactly the genuine engines with correct capabilities and targets", () => {
    const byId = Object.fromEntries(getEngines().map((e) => [e.id, e]));
    expect(Object.keys(byId).sort()).toEqual(["plugin-updater", "sync-bridge"]);
    expect(byId["plugin-updater"]).toMatchObject({ capability: "plugin-management", target: "everywhere" });
    expect(byId["sync-bridge"]).toMatchObject({ capability: "cross-app-sync", target: "cairn" });
  });

  // A capability provider is not an engine: it is managed like any other plugin. It still has
  // to be findable by capability, because that is how a consumer avoids naming it.
  it("keeps capability providers out of the engine list but findable by capability", () => {
    expect(getEngines().map((e) => e.id)).not.toContain("custom-auth");
    expect(isEngine("custom-auth")).toBe(false);
    expect(engineByCapability("custom-endpoints")).toMatchObject({ id: "custom-auth", meta: { configName: "custom-auth" } });
    expect(getCapabilityPlugins().map((e) => e.id)).toEqual(["custom-auth"]);
  });

  it("looks up by capability and by id", () => {
    expect(engineByCapability("cross-app-sync")?.id).toBe("sync-bridge");
    expect(engineByCapability("nope")).toBeUndefined();
    expect(engineById("plugin-updater")?.capability).toBe("plugin-management");
    expect(engineById("nope")).toBeUndefined();
  });

  it("classifies engines", () => {
    expect(isEngine("plugin-updater")).toBe(true);
    expect(isEngine("sync-bridge")).toBe(true);
    expect(isEngine("custom-auth")).toBe(false);
    expect(isEngine("wakatime-sync")).toBe(false);
  });

  it("BUILTIN_ENGINES urls are full clone URLs", () => {
    for (const e of [...BUILTIN_ENGINES, ...CAPABILITY_PLUGINS]) expect(e.url).toMatch(/^https:\/\/github\.com\//);
  });
});
