import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineConfig } from "./config.js";
import { createPluginRuntime } from "./plugin-runtime.js";

const homes: string[] = [];
let savedAppsFile: string | undefined;

function home(): string {
  const dir = mkdtempSync(join(tmpdir(), "core-runtime-"));
  homes.push(dir);
  return dir;
}

// paths resolve through the app registry, which without an override reads the developer's real
// ~/.config apps.json and prefix-matches it against these temp homes.
beforeAll(() => {
  savedAppsFile = process.env.HUB_APPS_FILE;
  process.env.HUB_APPS_FILE = join(home(), "apps.json");
});

afterAll(() => {
  if (savedAppsFile === undefined) delete process.env.HUB_APPS_FILE;
  else process.env.HUB_APPS_FILE = savedAppsFile;
});

afterEach(() => {
  homes.length = 0;
});

describe("createPluginRuntime", () => {
  it("reads defaults merged with what is on disk", () => {
    const dir = home();
    defineConfig("runtime-config", { interval: 30, logging: true }, dir);
    const runtime = createPluginRuntime("runtime-config", dir);
    expect(runtime.config.get("interval")).toBe(30);
    expect(runtime.config.all()).toMatchObject({ interval: 30, logging: true });
  });

  it("writes a setting to the config directory", async () => {
    const dir = home();
    const runtime = createPluginRuntime("runtime-write", dir);
    await runtime.config.set("interval", 60);
    const written = JSON.parse(readFileSync(join(dir, "config", "runtime-write.json"), "utf-8"));
    expect(written).toEqual({ interval: 60 });
    expect(runtime.config.get("interval")).toBe(60);
  });

  it("returns undefined for a key that is neither set nor defaulted", () => {
    const runtime = createPluginRuntime("runtime-absent", home());
    expect(runtime.config.get("nothing")).toBeUndefined();
  });

  it("resolves the home's storage directories", () => {
    const dir = home();
    const runtime = createPluginRuntime("runtime-paths", dir);
    expect(runtime.paths.home).toBe(dir);
    expect(runtime.paths.config).toBe(join(dir, "config"));
    expect(runtime.paths.plugin).toBe(join(dir, "plugin"));
    expect(runtime.paths.repos).toBe(join(dir, "repos"));
    expect(runtime.paths.cache).toBe(join(dir, "cache"));
  });

  it("resolves storage directories the home's registry entry renamed", () => {
    const dir = home();
    const appsFile = join(dir, "apps.json");
    writeFileSync(appsFile, JSON.stringify({
      demo: { id: "demo", label: "Demo", home: { candidates: [dir] }, paths: { plugin: "extensions", config: "settings" } },
    }));
    const previous = process.env.HUB_APPS_FILE;
    process.env.HUB_APPS_FILE = appsFile;
    try {
      const runtime = createPluginRuntime("runtime-registry", dir);
      expect(runtime.paths.plugin).toBe(join(dir, "extensions"));
      expect(runtime.paths.config).toBe(join(dir, "settings"));
      expect(runtime.paths.repos).toBe(join(dir, "repos"));
    } finally {
      if (previous === undefined) delete process.env.HUB_APPS_FILE;
      else process.env.HUB_APPS_FILE = previous;
    }
  });

  it("answers with every registered home, deduped by resolved path and marked present", () => {
    const dir = home();
    const absent = join(dir, "not-installed");
    const appsFile = join(dir, "apps.json");
    // `twin` resolves to the same directory as `demo`: a plugin acting per home must act once.
    writeFileSync(appsFile, JSON.stringify({
      demo: { id: "demo", label: "Demo", home: { candidates: [dir] }, loader: { id: "demo-loader", url: "https://github.com/intisy-ai/demo-loader" } },
      twin: { id: "twin", label: "Twin", home: { candidates: [dir] } },
      gone: { id: "gone", label: "Gone", home: { candidates: [absent] } },
    }));
    const previous = process.env.HUB_APPS_FILE;
    process.env.HUB_APPS_FILE = appsFile;
    try {
      const homes = createPluginRuntime("runtime-homes", dir).homes.all();
      expect(homes.map((entry) => entry.app)).toEqual(["demo", "gone"]);
      expect(homes[0]).toMatchObject({ label: "Demo", present: true, loader: "demo-loader" });
      expect(homes[0].paths).toMatchObject({ home: dir, config: join(dir, "config") });
      expect(homes[1]).toMatchObject({ present: false });
      expect(homes[1]).not.toHaveProperty("loader");
    } finally {
      if (previous === undefined) delete process.env.HUB_APPS_FILE;
      else process.env.HUB_APPS_FILE = previous;
    }
  });

  it("never throws from a log call", () => {
    const runtime = createPluginRuntime("runtime-log", home());
    expect(() => runtime.log.info("up")).not.toThrow();
    expect(() => runtime.log.warn("odd")).not.toThrow();
    expect(() => runtime.log.error("broken", new Error("cause"))).not.toThrow();
    expect(() => runtime.log.debug("detail")).not.toThrow();
  });

  // publish/subscribe ride core's file-backed bus (fs.watch plus a poll-interval
  // backstop), so delivery is never synchronous with the publish call; there is no
  // in-process shortcut to assert on. vi.waitFor lets the assertion retry until the
  // real bus delivers, rather than fixing an arbitrary sleep.
  it("delivers a published payload to a subscriber", async () => {
    const dir = home();
    const runtime = createPluginRuntime("runtime-events", dir);
    const seen: unknown[] = [];
    const stop = runtime.events.subscribe("config.changed", (payload) => seen.push(payload));
    runtime.events.publish("config.changed", { name: "runtime-events" });
    try {
      await vi.waitFor(() => expect(seen).toEqual([{ name: "runtime-events" }]), { timeout: 6000, interval: 50 });
    } finally {
      stop();
    }
  }, 10000);
});
