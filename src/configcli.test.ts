import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runConfigCli } from "./configcli.js";
import { runAllConfigCli } from "./configcli-all.js";
import { readActivity } from "./activity.js";
import { resetActivityContext, activityEnv } from "./activity-context.js";
import { getConfigValue } from "./config.js";

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

  it("puts the current trace on the environment a spawned config child would inherit", () => {
    let captured: Record<string, string> = {};
    runAllConfigCli(["some-plugin", "list"], {
      plugins: ["some-plugin"],
      resolveBundle: () => "/nonexistent/bundle.js",
      // activityEnv() is exactly what the real defaultRunChild merges into the child
      // env, so reading it here proves the value a child would receive.
      runChild: () => { captured = activityEnv(); return ""; },
    });

    expect(captured.HUB_ACTIVITY_TRACE).toBeTruthy();
    expect(JSON.parse(captured.HUB_ACTIVITY_CAUSE).kind).toBe("user");
  });

  // Every other trace-propagation test in this file (including the one above)
  // injects a fake runChild, so none of them would fail if the real defaultRunChild
  // stopped spreading activityEnv() into the child's environment. This one leaves
  // runChild unset, which exercises that real spawn path with a genuine child
  // process (a temp script standing in for a plugin's config-CLI bundle, so this
  // needs no network access or a real plugin build).
  it("delivers the trace through runAllConfigCli's own default spawn, not a test double", () => {
    const home = process.env.HUB_CONFIG_DIR as string;
    const script = join(home, "fake-plugin-bundle.mjs");
    writeFileSync(
      script,
      "console.log(JSON.stringify({ trace: process.env.HUB_ACTIVITY_TRACE, cause: process.env.HUB_ACTIVITY_CAUSE }));\n",
    );
    let captured = "";
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk: any) => { captured += chunk; return true; });
    try {
      runAllConfigCli(["some-plugin", "list"], {
        plugins: ["some-plugin"],
        resolveBundle: () => script,
      });
    } finally {
      writeSpy.mockRestore();
    }

    const child = JSON.parse(captured.trim());
    expect(child.trace).toBeTruthy();
    const cause = JSON.parse(child.cause);
    expect(cause.kind).toBe("user");
    expect(cause.surface).toBe("config");
    expect(cause.detail).toBe("some-plugin");
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
