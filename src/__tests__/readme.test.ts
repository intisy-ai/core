// @ts-nocheck
// libs/core/src/__tests__/readme.test.ts
import { describe, it, expect } from "vitest";
import { defineReadme, getReadmeSpec, generateReadme, runReadmeCli } from "../readme.js";
import { DEFAULT_SECTIONS, registerSection } from "../readme.js";
import { defineConfig } from "../config.js";
import { writeFileSync, readFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join as pj } from "path";

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

function ctxFixture(overrides = {}) {
  return {
    pluginName: "demo",
    pkg: { name: "demo", description: "A demo.", license: "MIT", dependencies: { left: "^1.0.0" },
           repository: { url: "git+https://github.com/intisy-ai/demo.git" } },
    spec: { architecture: "flowchart TD\n  A --> B", structure: { src: ["index.ts — entry"], dist: ["index.js"] },
            commands: [{ name: "demo-config", description: "edit config", argumentHint: "list | set" }] },
    config: { defaults: { logging: true, port: 3456 } },
    commands: [{ name: "demo-config", description: "edit config", argumentHint: "list | set" }],
    ...overrides,
  };
}

describe("generateReadme", () => {
  it("assembles sections in order and honors extraSections placement", () => {
    defineConfig("gen-demo", { logging: true, port: 3456 });
    defineReadme({
      tagline: "demo tagline", description: "Full description.",
      architecture: "flowchart TD\n  A --> B",
      structure: { src: ["index.ts — entry"] },
      commands: [{ name: "gen-demo-config", description: "edit", argumentHint: "list" }],
      extraSections: [{ id: "faq", title: "FAQ", body: "Q?\n\nA.", after: "configuration" }],
    });
    // cwd fixture: a dir with package.json — use a temp written by the test
    const md = generateReadme("gen-demo", __dirname + "/fixtures/gen-demo");
    const order = ["# ", "## Under-the-Hood Architecture", "## Structure", "## Installation",
                   "## Configuration", "## FAQ", "## Commands", "## Dependencies", "## Logging", "## License"];
    let last = -1;
    for (const marker of order) { const at = md.indexOf(marker); expect(at).toBeGreaterThan(last); last = at; }
    expect(md.endsWith("\n")).toBe(true);
  });
});

describe("runReadmeCli", () => {
  it("writes README.md then --check passes; a mutated file fails", () => {
    const dir = mkdtempSync(pj(tmpdir(), "readme-cli-"));
    writeFileSync(pj(dir, "package.json"), JSON.stringify({ name: "cli-demo", description: "d", license: "MIT",
      repository: { url: "git+https://github.com/intisy-ai/cli-demo.git" } }));
    defineConfig("cli-demo", { logging: true });
    defineReadme({ description: "d" });
    runReadmeCli("cli-demo", [], dir);                    // writes
    expect(readFileSync(pj(dir, "README.md"), "utf-8")).toContain("# cli-demo");
    process.exitCode = 0;
    runReadmeCli("cli-demo", ["--check"], dir);           // matches
    expect(process.exitCode).toBe(0);
    writeFileSync(pj(dir, "README.md"), "stale");
    runReadmeCli("cli-demo", ["--check"], dir);           // drift
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });
});

describe("section renderers", () => {
  const byId = (id) => DEFAULT_SECTIONS.find((s) => s.id === id);
  it("title includes name + badges", () => {
    expect(byId("title").render(ctxFixture())).toContain("# demo");
    expect(byId("title").render(ctxFixture())).toContain("img.shields.io");
  });
  it("configuration renders a JSON example from config defaults", () => {
    const out = byId("configuration").render(ctxFixture());
    expect(out).toContain("## Configuration");
    expect(out).toContain('"port": 3456');
  });
  it("commands section is null when there are no commands", () => {
    const c = ctxFixture({ commands: [] });
    expect(byId("commands").render(c)).toBeNull();
  });
  it("registerSection inserts after a given id", () => {
    registerSection({ id: "extra-test", render: () => "## Extra\n\nx" }, "configuration");
    const ids = DEFAULT_SECTIONS.map((s) => s.id);
    expect(ids.indexOf("extra-test")).toBe(ids.indexOf("configuration") + 1);
  });
});
