import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insertPluginIntoJsonc, registerPluginWithApp, resolveAppConfigFile } from "./app-plugins.js";
import type { AppDescriptor } from "./apps.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "core-app-plugins-"));
});

afterEach(() => {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
});

function describedAs(traits: Partial<AppDescriptor>): AppDescriptor {
  return {
    id: "zeta",
    label: "Zeta",
    home: { candidates: ["~/.zeta"] },
    detect: { binary: "zeta", pkg: "zeta" },
    commandsSubdir: "commands",
    paths: { repos: "repos", plugin: "plugin", cache: "cache", config: "config" },
    proxyPort: 0,
    integration: "env-baseurl",
    wireFormat: "anthropic",
    ...traits,
  };
}

const listing = describedAs({ npmPlugins: { configFiles: ["zeta.json", "zeta.jsonc"], pluginsKey: "plugin" } });
const hooking = describedAs({
  startupHook: {
    file: "settings.json",
    path: ["hooks", "OnStart"],
    entry: { hooks: [{ type: "command", command: "npx -y {plugin}@latest run" }] },
  },
});

function read(name: string): string {
  return readFileSync(join(dir, name), "utf-8");
}

describe("an app declaring a plugin list", () => {
  it("adds the plugin to an absent config", () => {
    const result = registerPluginWithApp(dir, listing, "widget");
    expect(result).toEqual({ target: join(dir, "zeta.json"), changed: true });
    expect(JSON.parse(read("zeta.json")).plugin).toEqual(["widget"]);
  });

  it("keeps the comments and the neighbours of a hand-edited config", () => {
    writeFileSync(join(dir, "zeta.jsonc"), '{\n  // keep me\n  "plugin": ["other"]\n}\n');
    registerPluginWithApp(dir, listing, "widget");
    const raw = read("zeta.jsonc");
    expect(raw).toContain("// keep me");
    expect(raw).toContain('["widget", "other"]');
  });

  it("adds the key when the config has none", () => {
    writeFileSync(join(dir, "zeta.json"), '{\n  "theme": "dark"\n}\n');
    registerPluginWithApp(dir, listing, "widget");
    const parsed = JSON.parse(read("zeta.json"));
    expect(parsed.plugin).toEqual(["widget"]);
    expect(parsed.theme).toBe("dark");
  });

  it("reports no change when the plugin is already listed, however it is spelled", () => {
    for (const listed of ['"widget"', '"widget@1.2.3"', '["widget", {}]']) {
      writeFileSync(join(dir, "zeta.json"), `{ "plugin": [${listed}] }`);
      expect(registerPluginWithApp(dir, listing, "widget")?.changed).toBe(false);
    }
  });

  it("uses the key the app declares, not a fixed one", () => {
    const keyed = describedAs({ npmPlugins: { configFiles: ["zeta.json"], pluginsKey: "extensions" } });
    registerPluginWithApp(dir, keyed, "widget");
    expect(JSON.parse(read("zeta.json")).extensions).toEqual(["widget"]);
  });
});

describe("an app declaring a startup hook", () => {
  it("appends the filled-in entry", () => {
    const result = registerPluginWithApp(dir, hooking, "widget");
    expect(result).toEqual({ target: join(dir, "settings.json"), changed: true });
    expect(JSON.parse(read("settings.json")).hooks.OnStart).toEqual([
      { hooks: [{ type: "command", command: "npx -y widget@latest run" }] },
    ]);
  });

  it("leaves the settings it did not write alone", () => {
    writeFileSync(join(dir, "settings.json"), JSON.stringify({ theme: "dark", hooks: { OnStart: [{ hooks: [] }] } }));
    registerPluginWithApp(dir, hooking, "widget");
    const parsed = JSON.parse(read("settings.json"));
    expect(parsed.theme).toBe("dark");
    expect(parsed.hooks.OnStart).toHaveLength(2);
  });

  it("reports no change on a second call", () => {
    registerPluginWithApp(dir, hooking, "widget");
    expect(registerPluginWithApp(dir, hooking, "widget")?.changed).toBe(false);
  });
});

describe("an app declaring neither", () => {
  it("registers nothing", () => {
    expect(registerPluginWithApp(dir, describedAs({}), "widget")).toBeNull();
    expect(registerPluginWithApp(dir, null, "widget")).toBeNull();
  });
});

describe("resolveAppConfigFile", () => {
  it("prefers a name that already exists over the first declared one", () => {
    writeFileSync(join(dir, "zeta.jsonc"), "{}");
    expect(resolveAppConfigFile(dir, ["zeta.json", "zeta.jsonc"])).toBe(join(dir, "zeta.jsonc"));
  });

  it("declares the first name when the home has none of them", () => {
    expect(resolveAppConfigFile(dir, ["zeta.json", "zeta.jsonc"])).toBe(join(dir, "zeta.json"));
  });
});

describe("insertPluginIntoJsonc", () => {
  it("refuses text it cannot edit safely", () => {
    expect(insertPluginIntoJsonc("not json at all", "widget", "plugin", true)).toBeNull();
  });

  it("picks the root array rather than a deeper one of the same name", () => {
    const raw = '{\n  "nested": { "plugin": ["deep"] },\n  "plugin": ["root"]\n}';
    expect(insertPluginIntoJsonc(raw, "widget", "plugin", true)).toContain('"plugin": ["widget", "root"]');
  });

  it("inserts into an empty array without a stray comma", () => {
    const out = insertPluginIntoJsonc('{\n  "plugin": []\n}', "widget", "plugin", true)!;
    expect(JSON.parse(out).plugin).toEqual(["widget"]);
  });

  it("keeps a [name, options] tuple entry intact", () => {
    const raw = '{\n  "plugin": [["@scope/x", { "bankId": "zeta" }]]\n}';
    const out = insertPluginIntoJsonc(raw, "widget", "plugin", true)!;
    expect(JSON.parse(out).plugin).toEqual(["widget", ["@scope/x", { bankId: "zeta" }]]);
  });

  it("adds the key to an empty object without producing a trailing comma", () => {
    expect(JSON.parse(insertPluginIntoJsonc("{}", "widget", "plugin", false)!).plugin).toEqual(["widget"]);
  });

  it("leaves a nested key of the same name untouched when the root has none", () => {
    const raw = '{\n  "models": { "plugin": ["m"] },\n  "$schema": "x"\n}';
    const parsed = JSON.parse(insertPluginIntoJsonc(raw, "widget", "plugin", false)!);
    expect(parsed.plugin).toEqual(["widget"]);
    expect(parsed.models.plugin).toEqual(["m"]);
    expect(parsed.$schema).toBe("x");
  });
});

describe("a declared schema url", () => {
  it("is stamped on a config this creates, and never over one already there", () => {
    const schemed = describedAs({ npmPlugins: { configFiles: ["zeta.json"], pluginsKey: "plugin", schemaUrl: "https://example.invalid/schema" } });
    registerPluginWithApp(dir, schemed, "widget");
    expect(JSON.parse(read("zeta.json")).$schema).toBe("https://example.invalid/schema");

    writeFileSync(join(dir, "zeta.json"), '{ "$schema": "kept" }');
    registerPluginWithApp(dir, schemed, "other");
    expect(JSON.parse(read("zeta.json")).$schema).toBe("kept");
  });
});
