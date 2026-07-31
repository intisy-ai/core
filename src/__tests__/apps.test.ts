import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  getApps,
  getApp,
  registerApp,
  resolveHome,
  resolveAppsFile,
  currentAppId,
  BUILTIN_APPS,
  type AppDescriptor,
} from "../apps.js";

function tempHome(): string {
  return mkdtempSync(join(tmpdir(), "core-apps-"));
}

function envWith(home: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { HUB_APPS_FILE: join(home, "apps.json"), ...extra };
}

describe("app registry", () => {
  let home: string;
  let env: NodeJS.ProcessEnv;
  beforeEach(() => {
    home = tempHome();
    env = envWith(home);
  });

  it("ships claude and opencode as built-in defaults", () => {
    const ids = getApps(env, home).map((a) => a.id).sort();
    expect(ids).toEqual(["claude", "opencode"]);
    expect(getApp("claude", env, home)?.builtin).toBe(true);
    expect(getApp("opencode", env, home)?.detect.pkg).toBe("opencode-ai");
  });

  it("carries a loader reference for each built-in app", () => {
    expect(getApp("claude", env, home)?.loader).toEqual({ id: "claude-code-loader", url: "intisy-ai/claude-code-loader" });
    expect(getApp("opencode", env, home)?.loader).toEqual({ id: "opencode-loader", url: "intisy-ai/opencode-loader" });
  });

  it("threads a loader from a custom apps.json entry", () => {
    const acme: AppDescriptor = {
      id: "acme", label: "Acme CLI",
      home: { candidates: [join(home, ".acme")] },
      detect: { binary: "acme", pkg: "acme-cli" },
      loader: { id: "acme-loader", url: "acme-org/acme-loader" },
      commandsSubdir: "commands", proxyPort: 34570,
      integration: "env-baseurl", wireFormat: "anthropic", builtin: false,
    };
    writeFileSync(join(home, "apps.json"), JSON.stringify({ acme }));
    expect(getApp("acme", env, home)?.loader).toEqual({ id: "acme-loader", url: "acme-org/acme-loader" });
  });

  it("returns built-ins only when apps.json is absent", () => {
    expect(getApps(env, home).length).toBe(2);
  });

  it("merges a new app from apps.json and marks it non-builtin", () => {
    const acme: AppDescriptor = {
      id: "acme", label: "Acme CLI",
      home: { candidates: [join(home, ".acme")] },
      detect: { binary: "acme", pkg: "acme-cli" },
      commandsSubdir: "commands", proxyPort: 34570,
      integration: "env-baseurl", wireFormat: "anthropic", builtin: false,
    };
    writeFileSync(join(home, "apps.json"), JSON.stringify({ acme }));
    const app = getApp("acme", env, home);
    expect(app?.label).toBe("Acme CLI");
    expect(app?.builtin).toBe(false);
    expect(getApps(env, home).map((a) => a.id).sort()).toEqual(["acme", "claude", "opencode"]);
  });

  it("lets an apps.json entry override built-in fields, keeping unspecified ones", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({ claude: { label: "Claude (custom)" } }));
    const app = getApp("claude", env, home)!;
    expect(app.label).toBe("Claude (custom)");
    expect(app.detect.pkg).toBe("@anthropic-ai/claude-code");
    expect(app.home.candidates).toEqual(BUILTIN_APPS.find((a) => a.id === "claude")!.home.candidates);
  });

  it("falls back to built-ins on malformed apps.json without throwing", () => {
    writeFileSync(join(home, "apps.json"), "{ not json");
    expect(getApps(env, home).map((a) => a.id).sort()).toEqual(["claude", "opencode"]);
  });

  it("busts the cache when apps.json mtime changes", () => {
    expect(getApps(env, home).length).toBe(2);
    writeFileSync(join(home, "apps.json"), JSON.stringify({
      acme: { id: "acme", label: "Acme", home: { candidates: [join(home, ".acme")] },
        detect: { binary: "acme", pkg: "acme-cli" }, commandsSubdir: "commands",
        proxyPort: 34570, integration: "env-baseurl", wireFormat: "anthropic", builtin: false },
    }));
    expect(getApps(env, home).length).toBe(3);
  });

  it("resolveHome honors envOverride, then nativeEnv, then xdg, then candidates", () => {
    const opencode = getApp("opencode", env, home)!;
    expect(resolveHome(opencode, { HUB_OPENCODE_DIR: "/o" }, home)).toBe("/o");
    expect(resolveHome(opencode, { OPENCODE_CONFIG_DIR: "/oc" }, home)).toBe("/oc");
    expect(resolveHome(opencode, { XDG_CONFIG_HOME: "/xdg" }, home)).toBe(join("/xdg", "opencode"));
  });

  it("resolveHome returns the first existing candidate, else the last", () => {
    const claude = getApp("claude", env, home)!;
    expect(resolveHome(claude, {}, home)).toBe(join(home, ".config", "claude"));
    mkdirSync(join(home, ".claude"));
    expect(resolveHome(claude, {}, home)).toBe(join(home, ".claude"));
  });

  it("registerApp writes/updates apps.json and is picked up by getApps", () => {
    registerApp({
      id: "acme", label: "Acme", home: { candidates: [join(home, ".acme")] },
      detect: { binary: "acme", pkg: "acme-cli" }, commandsSubdir: "commands",
      proxyPort: 34570, integration: "env-baseurl", wireFormat: "anthropic", builtin: false,
    }, env, home);
    expect(getApp("acme", env, home)?.label).toBe("Acme");
  });

  it("resolveAppsFile prefers HUB_APPS_FILE then ~/.config/cairn/apps.json", () => {
    expect(resolveAppsFile({ HUB_APPS_FILE: "/x/apps.json" }, home)).toBe("/x/apps.json");
    expect(resolveAppsFile({}, home)).toBe(join(home, ".config", "cairn", "apps.json"));
  });

  it("currentAppId detects claude from HUB_CONFIG_DIR shape, else defaults opencode", () => {
    expect(currentAppId({ CORE_APP: "claude" })).toBe("claude");
    expect(currentAppId({ HUB_CONFIG_DIR: "/home/u/.claude" })).toBe("claude");
    expect(currentAppId({})).toBe("opencode");
  });
});
