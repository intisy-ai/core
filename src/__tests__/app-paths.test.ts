import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { appPaths, getApp, DEFAULT_PATH_NAMES, type AppDescriptor } from "../apps.js";

function registryWith(paths?: Record<string, unknown>): { env: NodeJS.ProcessEnv; home: string } {
  const home = mkdtempSync(join(tmpdir(), "core-paths-"));
  const file = join(home, "apps.json");
  writeFileSync(
    file,
    JSON.stringify({
      alpha: {
        id: "alpha",
        label: "Alpha",
        home: { candidates: ["~/.alpha"] },
        detect: { binary: "alpha", pkg: "alpha" },
        ...(paths ? { paths } : {}),
      },
    }),
  );
  return { env: { HUB_APPS_FILE: file }, home };
}

describe("appPaths", () => {
  it("uses the conventional names when the app declares none", () => {
    const { env, home } = registryWith();
    const desc = getApp("alpha", env, home) as AppDescriptor;

    expect(desc.paths).toEqual(DEFAULT_PATH_NAMES);
    expect(appPaths("/home/app", desc, env)).toEqual({
      repos: join("/home/app", "repos"),
      plugin: join("/home/app", "plugin"),
      cache: join("/home/app", "cache"),
      config: join("/home/app", "config"),
    });
  });

  it("takes the names the app declares", () => {
    const { env, home } = registryWith({ repos: "clones", plugin: "extensions", cache: "tmp", config: "settings" });
    const desc = getApp("alpha", env, home) as AppDescriptor;

    expect(appPaths("/home/app", desc, env)).toEqual({
      repos: join("/home/app", "clones"),
      plugin: join("/home/app", "extensions"),
      cache: join("/home/app", "tmp"),
      config: join("/home/app", "settings"),
    });
  });

  it("fills only the names declared, leaving the rest conventional", () => {
    const { env, home } = registryWith({ repos: "clones" });
    const desc = getApp("alpha", env, home) as AppDescriptor;

    expect(desc.paths).toEqual({ ...DEFAULT_PATH_NAMES, repos: "clones" });
  });

  // The registry is the app's own declaration; the env override is how a consumer
  // that cannot read the registry (core-loader carries no core) is told the names.
  it("falls back to the env override when the app declares nothing", () => {
    const { env, home } = registryWith();
    const withEnv = { ...env, HUB_REPOS_SUBDIR: "clones" };
    expect(getApp("alpha", withEnv, home)?.paths.repos).toBe("clones");
  });

  it("prefers the app's own declaration over the env override", () => {
    const { env, home } = registryWith({ repos: "declared" });
    const withEnv = { ...env, HUB_REPOS_SUBDIR: "from-env" };
    expect(getApp("alpha", withEnv, home)?.paths.repos).toBe("declared");
  });

  // These name a directory INSIDE the app home. A separator or a traversal would
  // relocate storage outside it, silently orphaning everything already there.
  it("rejects a name that would escape the app home", () => {
    for (const bad of ["../elsewhere", "nested/dir", "back\\slash", "..", ".", "   ", ""]) {
      const { env, home } = registryWith({ repos: bad });
      expect(getApp("alpha", env, home)?.paths.repos).toBe("repos");
    }
  });

  it("resolves the conventional names with no descriptor at all", () => {
    expect(appPaths("/home/app", null, {})).toEqual({
      repos: join("/home/app", "repos"),
      plugin: join("/home/app", "plugin"),
      cache: join("/home/app", "cache"),
      config: join("/home/app", "config"),
    });
  });
});
