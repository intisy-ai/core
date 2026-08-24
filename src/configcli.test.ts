import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runConfigCli } from "./configcli.js";
import { runAllConfigCli } from "./configcli-all.js";
import { readActivity } from "./activity.js";
import { resetActivityContext } from "./activity-context.js";
import { defineConfig, getConfigValue } from "./config.js";

// A test-only seam: emitEvent delegates to the real implementation unless a test
// flips this flag, which lets one test simulate a throwing emitter without
// affecting any other test in this file.
const activityMock = vi.hoisted(() => ({ throwOnEmit: false }));

vi.mock("./activity.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./activity.js")>();
  return {
    ...actual,
    emitEvent: (...args: Parameters<typeof actual.emitEvent>) => {
      if (activityMock.throwOnEmit) throw new Error("emit boom");
      return actual.emitEvent(...args);
    },
  };
});

function tempHome(): string {
  const home = mkdtempSync(join(tmpdir(), "configcli-"));
  process.env.HUB_CONFIG_DIR = home;
  mkdirSync(join(home, "config"), { recursive: true });
  return home;
}

describe("the config CLI as an activity cause", () => {
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { resetActivityContext(); tempHome(); log = vi.spyOn(console, "log").mockImplementation(() => {}); });
  afterEach(() => { log.mockRestore(); });

  it("attributes a config set to the user and the surface that ran it", () => {
    const home = process.env.HUB_CONFIG_DIR as string;
    runConfigCli("some-plugin", ["set", "logging", "false"]);

    const [rec] = readActivity([home]).records;
    expect(rec.topic).toBe("config.changed");
    expect(rec.cause.kind).toBe("user");
    expect(rec.cause.surface).toBe("config set");
    expect(rec.cause.detail).toBe("some-plugin");
  });

  it("records the invocation itself only when the impact floor is lowered", () => {
    const quiet = process.env.HUB_CONFIG_DIR as string;
    runConfigCli("some-plugin", ["list"]);
    expect(readActivity([quiet]).records).toHaveLength(0);

    // A fresh home, because globalSetting caches per home per process.
    const loud = tempHome();
    writeFileSync(join(loud, "config", "settings.json"), JSON.stringify({ activityMinImpact: "debug" }));
    runConfigCli("some-plugin", ["list"]);

    const [rec] = readActivity([loud]).records;
    expect(rec.topic).toBe("command.invoked");
    expect(rec.impact).toBe("debug");
    expect(rec.cause.kind).toBe("user");
    expect(rec.cause.surface).toBe("config list");
  });

  it("does not record a schema probe as an invocation", () => {
    const home = tempHome();
    writeFileSync(join(home, "config", "settings.json"), JSON.stringify({ activityMinImpact: "debug" }));
    runConfigCli("some-plugin", ["schema"]);
    expect(readActivity([home]).records).toHaveLength(0);
  });

  // The dispatcher runs everything in this process now, so the cause it opens is what a recorded
  // change carries: there is no child environment left to propagate a trace through.
  it("records a change made through it as a user action on the config surface", () => {
    const home = process.env.HUB_CONFIG_DIR as string;
    defineConfig("traced-plugin", { logging: true }, home);

    runAllConfigCli(["traced-plugin", "set", "logging", "false"], { plugins: ["traced-plugin"] });

    const record = readActivity([home], { topics: ["config.changed"] }).records
      .find((entry) => entry.details.name === "traced-plugin");
    expect(record).toBeDefined();
    expect(record!.cause).toMatchObject({ kind: "user", detail: "traced-plugin" });
    expect(String(record!.cause.surface)).toContain("config");
  });

  it("still writes the config, and does not throw, when emitEvent itself throws", () => {
    const home = process.env.HUB_CONFIG_DIR as string;
    activityMock.throwOnEmit = true;
    try {
      expect(() => runConfigCli("some-plugin", ["set", "logging", "false"])).not.toThrow();
    } finally {
      activityMock.throwOnEmit = false;
    }
    expect(getConfigValue("some-plugin", "logging", home)).toBe(false);
  });
});

// A plugin declaring its settings in its manifest puts them in the host's own process, so nothing
// has to be spawned to read or change them. That is what keeps a broken plugin's settings editable.
describe("runAllConfigCli serves a declared plugin in-process", () => {
  it("reads and writes in this process", () => {
    const home = tempHome();
    defineConfig("declared-plugin", { interval: 60 }, home);

    runAllConfigCli(["declared-plugin", "set", "interval", "90"], { plugins: ["declared-plugin"] });

    expect(getConfigValue("declared-plugin", "interval", home)).toBe(90);
  });

  it("says so plainly when nothing can answer for a target", () => {
    tempHome();
    const lines: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => { lines.push(args.join(" ")); });
    try {
      runAllConfigCli(["absent-plugin", "list"], { plugins: [] });
    } finally {
      logSpy.mockRestore();
    }
    expect(lines.join("\n")).toContain("Unknown config target: absent-plugin");
  });
});
