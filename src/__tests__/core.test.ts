// @ts-nocheck
// Unit tests for core's foundation: the value coercion, the dot-path config
// get/set/list that powers `/<plugin>-config`, command deployment, and the hook
// guard. These underpin the shared test-kit (testing.ts) used by every plugin.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  coerce, setConfigValue, getConfigValue, listConfig,
  deployCommands, configCommand, isHookInvocation,
} from "../index.js";

let oc: string, cc: string, saved: Record<string, string | undefined>;
beforeEach(() => {
  oc = mkdtempSync(join(tmpdir(), "core-oc-"));
  cc = mkdtempSync(join(tmpdir(), "core-cc-"));
  saved = { CORE_APP: process.env.CORE_APP, HUB_OPENCODE_DIR: process.env.HUB_OPENCODE_DIR, HUB_CLAUDE_DIR: process.env.HUB_CLAUDE_DIR };
  process.env.CORE_APP = "opencode";
  process.env.HUB_OPENCODE_DIR = oc;
  process.env.HUB_CLAUDE_DIR = cc;
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  rmSync(oc, { recursive: true, force: true });
  rmSync(cc, { recursive: true, force: true });
});

describe("coerce", () => {
  it("parses primitives and JSON, else keeps the string", () => {
    expect(coerce("true")).toBe(true);
    expect(coerce("false")).toBe(false);
    expect(coerce("null")).toBe(null);
    expect(coerce("42")).toBe(42);
    expect(coerce("3.14")).toBe(3.14);
    expect(coerce('{"a":1}')).toEqual({ a: 1 });
    expect(coerce("[1,2]")).toEqual([1, 2]);
    expect(coerce("hello")).toBe("hello");
  });
});

describe("config get/set/list", () => {
  it("round-trips a top-level key to config/<name>.json", () => {
    setConfigValue("demo", "apiKey", "abc");
    expect(getConfigValue("demo", "apiKey")).toBe("abc");
    expect(listConfig("demo")).toMatchObject({ apiKey: "abc" });
    expect(existsSync(join(oc, "config", "demo.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(oc, "config", "demo.json"), "utf8")).apiKey).toBe("abc");
  });
  it("supports dot-path nesting", () => {
    setConfigValue("demo", "selection.strategy", "round-robin");
    expect(getConfigValue("demo", "selection.strategy")).toBe("round-robin");
    expect(getConfigValue("demo", "selection")).toEqual({ strategy: "round-robin" });
  });
});

describe("deployCommands + configCommand", () => {
  it("configCommand builds the /<name>-config definition", () => {
    const def = configCommand("demo");
    expect(def.name).toBe("demo-config");
    expect(def.shell).toContain("config $ARGUMENTS");
  });
  it("writes a command markdown file into the app command dir", () => {
    const written = deployCommands("demo", [configCommand("demo")]);
    expect(written.some((f) => f.endsWith("demo-config.md"))).toBe(true);
    expect(existsSync(join(oc, "command", "demo-config.md"))).toBe(true);
  });
});

describe("isHookInvocation", () => {
  it("treats a non-string first arg as a hook invocation", () => {
    expect(isHookInvocation(undefined)).toBe(false);
    expect(isHookInvocation("/some/dir")).toBe(false);
    expect(isHookInvocation({})).toBe(true);
    expect(isHookInvocation({ event: "x" })).toBe(true);
  });
});
