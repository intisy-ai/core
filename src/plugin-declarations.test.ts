import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginManifest } from "@intisy-ai/api";
import { applyManifestDeclarations, commandsFor } from "./plugin-declarations.js";
import { getConfigDefaults, loadConfig } from "./config.js";

let root: string;
let home: string;
let savedConfigDir: string | undefined;
let savedAppsFile: string | undefined;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "core-declarations-"));
  home = join(root, "zeta-home");
  mkdirSync(join(home, "config"), { recursive: true });
  mkdirSync(join(home, "commands"), { recursive: true });
  savedConfigDir = process.env.HUB_CONFIG_DIR;
  savedAppsFile = process.env.HUB_APPS_FILE;
  // Pinned, because the config reader resolves a home at import and would otherwise write
  // into the real one.
  process.env.HUB_CONFIG_DIR = home;
  process.env.HUB_APPS_FILE = join(root, "apps.json");
  writeFileSync(process.env.HUB_APPS_FILE, JSON.stringify({
    zeta: { id: "zeta", label: "Zeta", home: { candidates: [home] }, commandsSubdir: "commands" },
  }), "utf8");
});

afterEach(() => {
  if (savedConfigDir === undefined) delete process.env.HUB_CONFIG_DIR;
  else process.env.HUB_CONFIG_DIR = savedConfigDir;
  if (savedAppsFile === undefined) delete process.env.HUB_APPS_FILE;
  else process.env.HUB_APPS_FILE = savedAppsFile;
  try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
});

function manifest(extra: Partial<PluginManifest> = {}): PluginManifest {
  return { id: "widget", api: 1, ...extra } as PluginManifest;
}

describe("commandsFor", () => {
  it("contributes exactly what the manifest declares", () => {
    const commands = commandsFor(manifest({ commands: [{ name: "widget", description: "Show today's activity" }] }));
    expect(commands.map((command) => command.name)).toEqual(["widget"]);
  });

  // A plugin knows nothing about how its settings are edited: shipping settings must not put a
  // command in an app, because whether an app offers one is the host's business.
  it("contributes no command for a plugin that only ships settings", () => {
    expect(commandsFor(manifest({ config: { defaults: { logging: true } } }))).toEqual([]);
  });

  it("contributes nothing for a plugin that declares neither", () => {
    expect(commandsFor(manifest())).toEqual([]);
  });
});

describe("applyManifestDeclarations", () => {
  it("registers a plugin's settings without running it", () => {
    applyManifestDeclarations([manifest({ config: { defaults: { logging: true, interval: 60 } } })], home);

    expect(getConfigDefaults("widget")).toEqual({ logging: true, interval: 60 });
    expect(loadConfig("widget", home)).toEqual({});
  });

  it("leaves a value the home already has on disk in front of the default", () => {
    writeFileSync(join(home, "config", "widget.json"), JSON.stringify({ logging: false }), "utf8");
    applyManifestDeclarations([manifest({ config: { defaults: { logging: true } } })], home);

    expect(getConfigDefaults("widget").logging).toBe(true);
    expect(loadConfig("widget", home).logging).toBe(false);
  });

  it("writes a declared command into the app's own command directory", () => {
    const applied = applyManifestDeclarations([manifest({
      commands: [{ name: "widget", description: "Show today's activity", body: "Report it." }],
    })], home);

    const file = join(home, "commands", "widget.md");
    expect(applied[0].commands).toEqual([file]);
    const written = readFileSync(file, "utf8");
    expect(written).toContain("description: Show today's activity");
    expect(written).toContain("Report it.");
  });

  it("reports what it registered for each plugin", () => {
    const applied = applyManifestDeclarations([
      manifest({ config: { defaults: { logging: true } } }),
      manifest({ id: "other", commands: [{ name: "other", description: "Something else" }] }),
    ], home);

    expect(applied.map((entry) => entry.plugin)).toEqual(["widget", "other"]);
    expect(applied[0].settings).toEqual(["logging"]);
    expect(applied[0].commands).toEqual([]);
    expect(applied[1].settings).toEqual([]);
    expect(existsSync(join(home, "commands", "other.md"))).toBe(true);
  });

  it("skips a manifest that names nothing rather than registering under an empty id", () => {
    expect(applyManifestDeclarations([{ api: 1 } as PluginManifest], home)).toEqual([]);
  });

  it("declares nothing for a plugin whose manifest declares neither", () => {
    const applied = applyManifestDeclarations([manifest()], home);
    expect(applied).toEqual([{ plugin: "widget", settings: [], commands: [] }]);
  });
});
