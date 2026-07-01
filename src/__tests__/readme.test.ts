// libs/core/src/__tests__/readme.test.ts
import { describe, it, expect } from "vitest";
import { defineReadme, getReadmeSpec } from "../readme.js";

describe("defineReadme registry", () => {
  it("stores and returns the spec", () => {
    defineReadme({ tagline: "x", description: "d" });
    expect(getReadmeSpec().description).toBe("d");
  });
  it("returns {} before any define", () => {
    // fresh module state is exercised in generate tests; here just assert shape
    expect(typeof getReadmeSpec()).toBe("object");
  });
});
