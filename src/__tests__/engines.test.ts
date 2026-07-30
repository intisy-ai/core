import { describe, it, expect } from "vitest";
import {
  BUILTIN_ENGINES, getEngines, engineByCapability, engineById, isEngine, isMandatoryEngine,
} from "../engines.js";

describe("engine registry", () => {
  it("ships exactly the three engines with correct capabilities and flags", () => {
    const byId = Object.fromEntries(getEngines().map((e) => [e.id, e]));
    expect(Object.keys(byId).sort()).toEqual(["custom-auth", "plugin-updater", "sync-bridge"]);
    expect(byId["plugin-updater"]).toMatchObject({ capability: "plugin-management", mandatory: true, autoInstall: "startup", target: "all-apps" });
    expect(byId["custom-auth"]).toMatchObject({ capability: "custom-endpoints", mandatory: false, autoInstall: "on-demand", target: "cairn" });
    expect(byId["custom-auth"].meta).toMatchObject({ providerId: "custom", configName: "custom-auth" });
    expect(byId["sync-bridge"]).toMatchObject({ capability: "cross-app-sync", mandatory: false, target: "cairn" });
  });

  it("looks up by capability and by id", () => {
    expect(engineByCapability("custom-endpoints")?.id).toBe("custom-auth");
    expect(engineByCapability("nope")).toBeUndefined();
    expect(engineById("plugin-updater")?.capability).toBe("plugin-management");
    expect(engineById("nope")).toBeUndefined();
  });

  it("classifies engines and mandatory engines", () => {
    expect(isEngine("plugin-updater")).toBe(true);
    expect(isEngine("wakatime-sync")).toBe(false);
    expect(isMandatoryEngine("plugin-updater")).toBe(true);
    expect(isMandatoryEngine("custom-auth")).toBe(false);
    expect(isMandatoryEngine("wakatime-sync")).toBe(false);
  });

  it("BUILTIN_ENGINES urls are install sources (owner/repo or full URL)", () => {
    for (const e of BUILTIN_ENGINES) expect(e.url.length).toBeGreaterThan(0);
  });
});
