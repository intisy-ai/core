import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  getApps,
  getApp,
  registerApp,
  resolveHome,
  resolveAppsFile,
  currentAppId,
  type AppDescriptor,
} from "../apps.js";

function tempHome(): string {
  return mkdtempSync(join(tmpdir(), "core-apps-"));
}

function envWith(home: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { HUB_APPS_FILE: join(home, "apps.json"), ...extra };
}

const alpha: AppDescriptor = {
  id: "alpha",
  label: "Alpha CLI",
  home: {
    envOverride: "HUB_ALPHA_DIR",
    nativeEnv: "ALPHA_CONFIG_DIR",
    candidates: ["~/.alpha", "~/.config/alpha"],
  },
  detect: { binary: "alpha", pkg: "alpha-cli" },
  loader: { id: "alpha-loader", url: "acme-org/alpha-loader" },
  commandsSubdir: "commands",
  proxyPort: 40001,
  integration: "env-baseurl",
  wireFormat: "anthropic",
  usage: { formats: ["alpha-jsonl"] },
};

const beta: AppDescriptor = {
  id: "beta",
  label: "Beta CLI",
  home: {
    envOverride: "HUB_BETA_DIR",
    nativeEnv: "BETA_CONFIG_DIR",
    xdgSubdir: "beta",
    candidates: ["~/.config/beta", "~/.beta"],
  },
  detect: { binary: "beta", pkg: "beta-cli" },
  commandsSubdir: "command",
  proxyPort: 40002,
  integration: "native",
  wireFormat: "anthropic",
};

describe("app registry", () => {
  let home: string;
  let env: NodeJS.ProcessEnv;
  beforeEach(() => {
    home = tempHome();
    env = envWith(home);
  });

  it("returns an empty list when apps.json is absent", () => {
    expect(getApps(env, home)).toEqual([]);
  });

  it("returns an empty list when apps.json is empty", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({}));
    expect(getApps(env, home)).toEqual([]);
  });

  it("reads descriptors solely from apps.json", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({ alpha, beta }));
    const ids = getApps(env, home).map((a) => a.id).sort();
    expect(ids).toEqual(["alpha", "beta"]);
    expect(getApp("alpha", env, home)?.detect.pkg).toBe("alpha-cli");
    expect(getApp("alpha", env, home)?.loader).toEqual({ id: "alpha-loader", url: "acme-org/alpha-loader" });
  });

  it("defaults an entry's id from its apps.json map key", () => {
    const { id: _id, ...withoutId } = alpha;
    writeFileSync(join(home, "apps.json"), JSON.stringify({ alpha: withoutId }));
    expect(getApp("alpha", env, home)?.id).toBe("alpha");
  });

  it("defaults detect.binary and other optional fields", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({
      gamma: { id: "gamma", label: "Gamma", home: { candidates: [join(home, ".gamma")] } },
    }));
    const app = getApp("gamma", env, home)!;
    expect(app.detect.binary).toBe("gamma");
    expect(app.commandsSubdir).toBe("commands");
    expect(app.integration).toBe("env-baseurl");
    expect(app.wireFormat).toBe("anthropic");
  });

  it("falls back to an empty list on malformed apps.json without throwing", () => {
    writeFileSync(join(home, "apps.json"), "{ not json");
    expect(getApps(env, home)).toEqual([]);
  });

  it("skips invalid entries (missing label or candidates)", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({
      alpha,
      bad: { id: "bad", home: { candidates: [] } },
    }));
    expect(getApps(env, home).map((a) => a.id)).toEqual(["alpha"]);
  });

  it("busts the cache when apps.json mtime changes", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({ alpha }));
    expect(getApps(env, home).length).toBe(1);
    writeFileSync(join(home, "apps.json"), JSON.stringify({ alpha, beta }));
    expect(getApps(env, home).length).toBe(2);
  });

  it("resolveHome honors envOverride, then nativeEnv, then xdg, then candidates", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({ beta }));
    const desc = getApp("beta", env, home)!;
    expect(resolveHome(desc, { HUB_BETA_DIR: "/b" }, home)).toBe("/b");
    expect(resolveHome(desc, { BETA_CONFIG_DIR: "/bc" }, home)).toBe("/bc");
    expect(resolveHome(desc, { XDG_CONFIG_HOME: "/xdg" }, home)).toBe(join("/xdg", "beta"));
  });

  it("resolveHome returns the first existing candidate, else the last", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({ alpha }));
    const desc = getApp("alpha", env, home)!;
    expect(resolveHome(desc, {}, home)).toBe(join(home, ".config", "alpha"));
    mkdirSync(join(home, ".alpha"));
    expect(resolveHome(desc, {}, home)).toBe(join(home, ".alpha"));
  });

  it("registerApp writes/updates apps.json and round-trips through getApps", () => {
    expect(getApps(env, home)).toEqual([]);
    registerApp(alpha, env, home);
    expect(getApp("alpha", env, home)?.label).toBe("Alpha CLI");
    expect(getApps(env, home).map((a) => a.id)).toEqual(["alpha"]);
  });

  it("resolveAppsFile prefers HUB_APPS_FILE then ~/.config/cairn/apps.json", () => {
    expect(resolveAppsFile({ HUB_APPS_FILE: "/x/apps.json" }, home)).toBe("/x/apps.json");
    expect(resolveAppsFile({}, home)).toBe(join(home, ".config", "cairn", "apps.json"));
  });

  it("currentAppId returns CORE_APP verbatim when set", () => {
    expect(currentAppId({ CORE_APP: "acme" })).toBe("acme");
  });

  it("currentAppId matches a descriptor by detect.binary as an argv token", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({ alpha, beta }));
    const originalArgv = process.argv;
    process.argv = ["/usr/bin/node", "/usr/lib/node_modules/alpha-cli/bin/alpha.js"];
    try {
      expect(currentAppId(env)).toBe("alpha");
    } finally {
      process.argv = originalArgv;
    }
  });

  it("currentAppId matches a descriptor whose nativeEnv is set", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({ alpha, beta }));
    const originalArgv = process.argv;
    process.argv = ["/usr/bin/node", "/test-runner/entry.js"];
    try {
      expect(currentAppId({ ...env, BETA_CONFIG_DIR: "/somewhere/beta" })).toBe("beta");
    } finally {
      process.argv = originalArgv;
    }
  });

  it("currentAppId matches a descriptor via HUB_CONFIG_DIR path containment", () => {
    // absolute (non "~") candidate so the match doesn't depend on the real user homedir
    const gamma: AppDescriptor = {
      id: "gamma", label: "Gamma CLI",
      home: { candidates: [join(home, "gamma-dir")] },
      detect: { binary: "gamma", pkg: "gamma-cli" },
      commandsSubdir: "commands", proxyPort: 40003,
      integration: "env-baseurl", wireFormat: "anthropic",
    };
    writeFileSync(join(home, "apps.json"), JSON.stringify({ alpha, beta, gamma }));
    const forced = join(home, "gamma-dir", "nested");
    const originalArgv = process.argv;
    process.argv = ["/usr/bin/node", "/test-runner/entry.js"];
    try {
      expect(currentAppId({ ...env, HUB_CONFIG_DIR: forced })).toBe("gamma");
    } finally {
      process.argv = originalArgv;
    }
  });

  it("currentAppId returns an empty string when nothing matches", () => {
    writeFileSync(join(home, "apps.json"), JSON.stringify({ alpha, beta }));
    const originalArgv = process.argv;
    process.argv = ["/usr/bin/node", "/usr/lib/node_modules/unrelated/cli.js"];
    try {
      expect(currentAppId(env)).toBe("");
    } finally {
      process.argv = originalArgv;
    }
  });
});
