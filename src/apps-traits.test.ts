import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expandPath, getApp } from "./apps.js";

let dir: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "core-apps-traits-"));
  env = { HUB_APPS_FILE: join(dir, "apps.json") } as NodeJS.ProcessEnv;
});

afterEach(() => {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
});

function write(entry: Record<string, unknown>): void {
  writeFileSync(join(dir, "apps.json"), JSON.stringify({ zeta: entry }));
}

describe("declared traits survive the registry read", () => {
  it("carries every trait through", () => {
    write({
      id: "zeta", label: "Zeta", home: { candidates: ["~/.zeta"] },
      accent: "#123456",
      wrapperCommand: "zc",
      npmPlugins: { configFiles: ["zeta.json"], pluginsKey: "plugin", packageCache: "~/.cache/zeta" },
      discovery: { topic: "zeta-plugin", searchQuery: "zeta", awesomeList: "https://example.invalid/list.md" },
      projects: { historyFile: "history.jsonl", sessionDb: ["~/.local/share/zeta/zeta.db", "zeta.db"], markerFile: "zeta" },
      modelCatalog: { files: ["zeta.json"], envOverride: "ZETA_CONFIG", schemaUrl: "https://example.invalid/schema", providerKey: "provider" },
      startupHook: { file: "settings.json", path: ["hooks", "OnStart"], entry: { command: "run {plugin}" } },
    });
    const desc = getApp("zeta", env, dir);
    expect(desc?.accent).toBe("#123456");
    expect(desc?.wrapperCommand).toBe("zc");
    expect(desc?.npmPlugins).toEqual({ configFiles: ["zeta.json"], pluginsKey: "plugin", packageCache: "~/.cache/zeta" });
    expect(desc?.discovery?.topic).toBe("zeta-plugin");
    expect(desc?.projects?.sessionDb).toEqual(["~/.local/share/zeta/zeta.db", "zeta.db"]);
    expect(desc?.projects?.markerFile).toBe("zeta");
    expect(desc?.modelCatalog?.providerKey).toBe("provider");
    expect(desc?.startupHook?.path).toEqual(["hooks", "OnStart"]);
  });

  it("leaves an undeclared trait undefined rather than defaulting it", () => {
    write({ id: "zeta", label: "Zeta", home: { candidates: ["~/.zeta"] } });
    const desc = getApp("zeta", env, dir);
    expect(desc?.accent).toBeUndefined();
    expect(desc?.wrapperCommand).toBeUndefined();
    expect(desc?.npmPlugins).toBeUndefined();
    expect(desc?.discovery).toBeUndefined();
    expect(desc?.projects).toBeUndefined();
    expect(desc?.modelCatalog).toBeUndefined();
    expect(desc?.startupHook).toBeUndefined();
  });
});

describe("expandPath", () => {
  it("expands a leading tilde against the user home", () => {
    expect(expandPath("~/.cache/zeta", "/users/me", "/homes/zeta")).toBe(join("/users/me", ".cache/zeta"));
  });

  it("returns an absolute path unchanged", () => {
    const absolute = join("/", "opt", "zeta.db");
    expect(expandPath(absolute, "/users/me", "/homes/zeta")).toBe(absolute);
  });

  it("resolves anything else against the app home", () => {
    expect(expandPath("history.jsonl", "/users/me", "/homes/zeta")).toBe(join("/homes/zeta", "history.jsonl"));
  });
});
