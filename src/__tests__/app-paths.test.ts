import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, existsSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { appPathNames, appPaths, getApp, setAppPaths, DEFAULT_PATH_NAMES, type AppDescriptor } from "../apps.js";
import { moveAppPaths, movesFailed, pathNameError, validatePathNames } from "../app-paths.js";

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

  // The registry is the app's own declaration; the env override is how a consumer that may not
  // reference this library (core-auth sits in its own layer) is told the names.
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

describe("validatePathNames", () => {
  it("accepts four ordinary names", () => {
    expect(validatePathNames(DEFAULT_PATH_NAMES)).toEqual({});
  });

  // The resolver quietly substitutes the conventional name for an unusable one, which
  // would show someone their entry being accepted and then ignored.
  it("says what is wrong with a name instead of falling back", () => {
    expect(pathNameError("")).toMatch(/empty/);
    expect(pathNameError("   ")).toMatch(/empty/);
    expect(pathNameError("..")).toMatch(/\. or \.\./);
    expect(pathNameError("nested/dir")).toMatch(/separator/);
    expect(pathNameError("back\\slash")).toMatch(/separator/);
    expect(pathNameError("repos")).toBeNull();
  });

  it("reports the offending kind", () => {
    const errors = validatePathNames({ ...DEFAULT_PATH_NAMES, cache: "../escape" });
    expect(Object.keys(errors)).toEqual(["cache"]);
  });

  // Two kinds in one directory would put each one's contents under the other.
  it("refuses two kinds pointing at the same directory", () => {
    const errors = validatePathNames({ ...DEFAULT_PATH_NAMES, cache: "repos" });
    expect(errors.cache).toMatch(/same as repos/);
    expect(errors.repos).toBeUndefined();
  });
});

describe("moveAppPaths", () => {
  function homeWith(dirs: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), "core-move-"));
    for (const name of dirs) mkdirSync(join(dir, name), { recursive: true });
    return dir;
  }

  it("renames only the kinds whose name changed", () => {
    const dir = homeWith(["repos", "cache"]);
    writeFileSync(join(dir, "repos", "marker"), "x");

    const moves = moveAppPaths(dir, DEFAULT_PATH_NAMES, { ...DEFAULT_PATH_NAMES, repos: "clones" });

    expect(moves).toEqual([{ kind: "repos", from: "repos", to: "clones", status: "moved" }]);
    expect(readFileSync(join(dir, "clones", "marker"), "utf-8")).toBe("x");
    expect(existsSync(join(dir, "repos"))).toBe(false);
    expect(existsSync(join(dir, "cache"))).toBe(true);
  });

  it("has nothing to move when the directory was never created", () => {
    const dir = homeWith([]);
    const moves = moveAppPaths(dir, DEFAULT_PATH_NAMES, { ...DEFAULT_PATH_NAMES, repos: "clones" });
    expect(moves[0].status).toBe("nothing-to-move");
    expect(movesFailed(moves)).toEqual([]);
  });

  // Merging two directories of clones together silently is worse than refusing.
  it("refuses to move onto a directory that already exists", () => {
    const dir = homeWith(["repos", "clones"]);
    const moves = moveAppPaths(dir, DEFAULT_PATH_NAMES, { ...DEFAULT_PATH_NAMES, repos: "clones" });

    expect(moves[0].status).toBe("target-exists");
    expect(movesFailed(moves)).toHaveLength(1);
    expect(existsSync(join(dir, "repos"))).toBe(true);
  });

  it("does nothing at all when no name changed", () => {
    const dir = homeWith(["repos"]);
    expect(moveAppPaths(dir, DEFAULT_PATH_NAMES, DEFAULT_PATH_NAMES)).toEqual([]);
  });
});

describe("setAppPaths", () => {
  it("stores the new names and leaves the rest of the descriptor alone", () => {
    const { env, home } = registryWith();
    setAppPaths("alpha", { ...DEFAULT_PATH_NAMES, repos: "clones" }, env, home);

    const app = getApp("alpha", env, home);
    expect(app?.paths).toEqual({ ...DEFAULT_PATH_NAMES, repos: "clones" });
    expect(app?.label).toBe("Alpha");
    expect(app?.detect.binary).toBe("alpha");
  });

  it("refuses an app the registry does not hold", () => {
    const { env, home } = registryWith();
    expect(() => setAppPaths("ghost", DEFAULT_PATH_NAMES, env, home)).toThrow(/unknown app/);
  });
});

describe("appPathNames", () => {
  it("gives the app's own declared names", () => {
    const { env, home } = registryWith({ repos: "declared" });
    expect(appPathNames(getApp("alpha", env, home))?.repos).toBe("declared");
  });

  // The name-only counterpart of appPaths, for a consumer that needs the segment rather than the
  // absolute directory: without a descriptor it answers from the env, exactly as appPaths does.
  it("falls back to the env override with no descriptor, then to the default", () => {
    expect(appPathNames(null, { HUB_REPOS_SUBDIR: "clones" }).repos).toBe("clones");
    expect(appPathNames(null, {})).toEqual(DEFAULT_PATH_NAMES);
  });
});
