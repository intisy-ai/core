import { describe, it, expect } from "vitest";
import { KNOWN_PLUGINS, knownPlugins, pluginByCapability, isBootstrapPlugin } from "../engines.js";

describe("known plugins", () => {
  it("registers each plugin under exactly one capability", () => {
    const capabilities = knownPlugins().map((p) => p.capability);
    expect([...new Set(capabilities)]).toEqual(capabilities);
  });

  it("answers what serves a capability, so nothing has to name a plugin", () => {
    expect(pluginByCapability("plugin-management")?.id).toBe("plugin-updater");
    expect(pluginByCapability("cross-app-sync")?.id).toBe("sync-bridge");
    expect(pluginByCapability("custom-endpoints")).toMatchObject({ id: "custom-auth", meta: { configName: "custom-auth" } });
    expect(pluginByCapability("nope")).toBeUndefined();
  });

  // The manager is the one plugin nothing else can install. Exempting anything else would let
  // a genuinely missing manager pass unnoticed.
  it("exempts only the plugin manager from needing the manager", () => {
    expect(knownPlugins().filter((p) => p.bootstrap).map((p) => p.id)).toEqual(["plugin-updater"]);
    expect(isBootstrapPlugin("plugin-updater")).toBe(true);
    expect(isBootstrapPlugin("sync-bridge")).toBe(false);
    expect(isBootstrapPlugin("custom-auth")).toBe(false);
    expect(isBootstrapPlugin("wakatime-sync")).toBe(false);
  });

  it("carries a full clone URL for every entry", () => {
    for (const p of KNOWN_PLUGINS) expect(p.url).toMatch(/^https:\/\/github\.com\//);
  });
});
