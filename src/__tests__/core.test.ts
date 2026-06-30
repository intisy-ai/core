// @ts-nocheck
// Unit tests for core's foundation: the value coercion, the dot-path config
// get/set/list that powers `/<plugin>-config`, command deployment, and the hook
// guard. These underpin the shared test-kit (testing.ts) used by every plugin.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  coerce, setConfigValue, getConfigValue, listConfig, defineConfig, getConfigDefaults,
  deployCommands, configCommand, isHookInvocation, runConfigCli,
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

describe("defineConfig", () => {
  it("registers defaults and returns the effective config but writes NO file", () => {
    const cfg = defineConfig("demo", { logging: true, port: 3000 });
    expect(cfg).toMatchObject({ logging: true, port: 3000 });
    // launching must never create a config file — only setConfigValue does
    expect(existsSync(join(oc, "config", "demo.json"))).toBe(false);
    expect(getConfigDefaults("demo")).toMatchObject({ logging: true, port: 3000 });
  });
  it("never creates a file even for a logging-only default", () => {
    defineConfig("triv", { logging: true });
    expect(existsSync(join(oc, "config", "triv.json"))).toBe(false);
  });
  it("merges on-disk values over declared defaults; on-disk wins", () => {
    setConfigValue("demo2", "logging", false);
    const cfg = defineConfig("demo2", { logging: true, port: 3000 });
    expect(cfg.logging).toBe(false);
    expect(cfg.port).toBe(3000);
  });
});

describe("config schema CLI", () => {
  it("prints declared defaults + current values as JSON for the loader", () => {
    defineConfig("schemademo", { logging: true, strategy: "hybrid" });
    setConfigValue("schemademo", "strategy", "round-robin");
    const lines: string[] = [];
    const orig = console.log;
    console.log = (m?: unknown) => { lines.push(String(m)); };
    try { runConfigCli("schemademo", ["schema"]); } finally { console.log = orig; }
    const out = JSON.parse(lines[0]);
    expect(out.name).toBe("schemademo");
    expect(out.defaults).toMatchObject({ logging: true, strategy: "hybrid" });
    expect(out.current).toMatchObject({ strategy: "round-robin" });
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

import { mkdtempSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runAllConfigCli } from "../configcli-all.js";
import { globalSetting } from "../log.js";

describe("runAllConfigCli", () => {
  function tempHome() {
    const dir = mkdtempSync(join(tmpdir(), "core-allcfg-"));
    process.env.CORE_APP = "opencode";
    process.env.HUB_OPENCODE_DIR = dir;
    return dir;
  }
  afterEach(() => { delete process.env.HUB_OPENCODE_DIR; delete process.env.CORE_APP; });

  it("global set writes config/settings.json and globalSetting reads it back", () => {
    const dir = tempHome();
    runAllConfigCli(["global", "set", "logColor", "false"], { plugins: [], resolveBundle: () => null });
    const file = join(dir, "config", "settings.json");
    expect(existsSync(file)).toBe(true);
    expect(JSON.parse(readFileSync(file, "utf8")).logColor).toBe(false);
    expect(globalSetting("logColor", true)).toBe(false);
  });

  it("dispatches a named plugin to its bundle via runChild", () => {
    tempHome();
    const calls: Array<[string, string[]]> = [];
    const runChild = (b: string, a: string[]) => { calls.push([b, a]); return "STUB_OUTPUT\n"; };
    const resolveBundle = (n: string) => (n === "foo" ? "/x/foo.js" : null);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true as never);
    runAllConfigCli(["foo", "list"], { plugins: ["foo"], resolveBundle, runChild });
    expect(calls).toEqual([["/x/foo.js", ["list"]]]);
    spy.mockRestore(); out.mockRestore();
  });

  it("prints an error for an unknown target", () => {
    tempHome();
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    runAllConfigCli(["nope", "list"], { plugins: [], resolveBundle: () => null });
    expect(spy.mock.calls.flat().join(" ")).toContain("Unknown config target");
    spy.mockRestore();
  });

  it("aggregate listing covers global + each plugin", () => {
    tempHome();
    const seen: string[] = [];
    const runChild = (_b: string, a: string[]) => { seen.push(a.join(" ")); return ""; };
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...m: unknown[]) => { logs.push(m.join(" ")); });
    const out = vi.spyOn(process.stdout, "write").mockImplementation(() => true as never);
    runAllConfigCli([], { plugins: ["foo"], resolveBundle: () => "/x/foo.js", runChild });
    expect(logs.join("\n")).toContain("# global");
    expect(logs.join("\n")).toContain("# foo");
    expect(seen).toContain("list");
    spy.mockRestore(); out.mockRestore();
  });
});
