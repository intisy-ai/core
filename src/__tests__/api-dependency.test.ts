import { describe, expect, it } from "vitest";
import { API_VERSION } from "@intisy-ai/api";
import { ACTIVITY, LIBRARY_MANAGEMENT, PLUGIN_MANAGEMENT, SETTINGS } from "../generated/contracts.keys.js";

describe("core depends on the api package", () => {
  // Asserts resolution, not the number. Pinning the value here coupled a resolution check to a
  // constant that legitimately rises, so every api major bump broke this test in every consumer;
  // the value itself is pinned in api's own suite, against the version the Java emits.
  it("resolves the api package by its scoped name", () => {
    expect(typeof API_VERSION).toBe("number");
    expect(API_VERSION).toBeGreaterThanOrEqual(1);
  });

  // core is now the library that MINTS this vocabulary, from its own annotated Java, so these come
  // from the generated surface rather than from a dependency.
  it("mints the capability vocabulary it renders", () => {
    expect(SETTINGS.id).toBe("settings");
    expect(PLUGIN_MANAGEMENT.id).toBe("plugin-management");
  });

  it("mints the service contracts it renders", () => {
    expect(ACTIVITY.id).toBe("activity");
  });

  // A library is a different noun from a plugin, so it is its own capability rather than more
  // methods on plugin-management.
  it("mints library management beside plugin management", () => {
    expect(LIBRARY_MANAGEMENT.id).toBe("library-management");
  });
});
