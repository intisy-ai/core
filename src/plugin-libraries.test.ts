import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  declaredLibraries,
  dropLibrary,
  materializeLibraries,
  mergeRange,
  pruneAbandonedPluginStore,
  sharedStoreDir,
  type StoreInstaller,
} from "./plugin-libraries.js";

// ESM's "node:fs" namespace is non-configurable, so vi.spyOn can't touch rmSync directly.
// This mock passes every call straight through to the real fs, except rmSync while
// rmSyncFailure is armed, which lets one test simulate a locked file honestly.
let rmSyncFailure: Error | null = null;
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  const rmSync: typeof actual.rmSync = (path, options) => {
    if (rmSyncFailure) throw rmSyncFailure;
    return actual.rmSync(path, options);
  };
  return { ...actual, rmSync, default: { ...actual.default, rmSync } };
});

let workDir: string | undefined;
afterEach(() => {
  rmSyncFailure = null;
  if (workDir) rmSync(workDir, { recursive: true, force: true });
  workDir = undefined;
});

function makeWorkDir(): string {
  workDir = mkdtempSync(join(tmpdir(), "shared-store-"));
  return workDir;
}

function makeClone(dependencies: Record<string, string>, peerDependencies?: Record<string, string>): string {
  const sourceDir = join(makeWorkDir(), "repos", "example");
  mkdirSync(sourceDir, { recursive: true });
  const pkg: Record<string, unknown> = { name: "example", version: "1.0.0", dependencies };
  if (peerDependencies) pkg.peerDependencies = peerDependencies;
  writeFileSync(join(sourceDir, "package.json"), JSON.stringify(pkg));
  return sourceDir;
}

function homeFor(sourceDir: string): string {
  return join(sourceDir, "..", "..", "home");
}

// Stands in for `npm install`: records the call and writes the store the real npm would have
// written, so a test asserts on placement without reaching the registry.
function fakeInstaller(): StoreInstaller & { calls: string[] } {
  const calls: string[] = [];
  const install = ((configDir: string) => {
    calls.push(configDir);
    const declared = JSON.parse(readFileSync(join(configDir, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    for (const [specifier, range] of Object.entries(declared.dependencies ?? {})) {
      const dir = join(sharedStoreDir(configDir), ...specifier.split("/"));
      mkdirSync(join(dir, "dist"), { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name: specifier, version: range.replace(/^\^/, "") }));
    }
  }) as StoreInstaller & { calls: string[] };
  install.calls = calls;
  return install;
}

describe("declaredLibraries", () => {
  it("reads the scoped dependencies a clone's package.json declares", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "^1.1.0", "@intisy-ai/api": "^1.0.2" });
    expect(declaredLibraries(sourceDir)).toEqual([
      { specifier: "@intisy-ai/core", range: "^1.1.0" },
      { specifier: "@intisy-ai/api", range: "^1.0.2" },
    ]);
  });

  it("ignores a dependency outside the ecosystem scope", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "^1.1.0", vitest: "^3.0.0", esbuild: "^0.25.0" });
    expect(declaredLibraries(sourceDir).map((library) => library.specifier)).toEqual(["@intisy-ai/core"]);
  });

  it("includes a peer dependency, which a consumer still has to resolve", () => {
    const sourceDir = makeClone({}, { "@intisy-ai/core-auth": "^1.1.0" });
    expect(declaredLibraries(sourceDir)).toEqual([{ specifier: "@intisy-ai/core-auth", range: "^1.1.0" }]);
  });

  it("prefers the dependencies entry when a library is in both groups", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "^1.1.0" }, { "@intisy-ai/core": "^1.0.0" });
    expect(declaredLibraries(sourceDir)).toEqual([{ specifier: "@intisy-ai/core", range: "^1.1.0" }]);
  });

  it("skips a file: spec, which describes a path in the clone and cannot describe a home install", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "file:core", "@intisy-ai/api": "^1.0.2" });
    expect(declaredLibraries(sourceDir).map((library) => library.specifier)).toEqual(["@intisy-ai/api"]);
  });

  it("returns nothing for a clone that declares no libraries", () => {
    expect(declaredLibraries(makeClone({}))).toEqual([]);
  });

  it("returns nothing rather than throwing for a directory with no package.json", () => {
    expect(declaredLibraries(makeWorkDir())).toEqual([]);
  });
});

describe("mergeRange", () => {
  it("takes the incoming range when the home asks for nothing yet", () => {
    expect(mergeRange(undefined, "^1.1.0")).toEqual({ range: "^1.1.0" });
  });

  it("keeps the more restrictive of two carets on the same major, which satisfies both asks", () => {
    expect(mergeRange("^1.0.0", "^1.1.0")).toEqual({ range: "^1.1.0" });
    expect(mergeRange("^1.1.0", "^1.0.0")).toEqual({ range: "^1.1.0" });
  });

  it("compares patch when the minors are equal", () => {
    expect(mergeRange("^1.1.0", "^1.1.4")).toEqual({ range: "^1.1.4" });
    expect(mergeRange("^1.1.4", "^1.1.0")).toEqual({ range: "^1.1.4" });
  });

  it("compares numerically, so a two-digit minor beats a one-digit one", () => {
    expect(mergeRange("^1.9.0", "^1.10.0")).toEqual({ range: "^1.10.0" });
  });

  it("reports a conflict across majors instead of silently picking, and keeps the higher", () => {
    const merged = mergeRange("^1.1.0", "^2.0.0");
    expect(merged.range).toBe("^2.0.0");
    expect(merged.conflict).toContain("different majors");
  });

  it("keeps the higher major whichever side it arrives on", () => {
    expect(mergeRange("^2.0.0", "^1.1.0").range).toBe("^2.0.0");
  });

  it("keeps an existing pin rather than widening it behind the pinner's back", () => {
    const merged = mergeRange("1.1.0", "^1.2.0");
    expect(merged.range).toBe("1.1.0");
    expect(merged.conflict).toContain("cannot compare");
  });

  it("treats two identical ranges as agreement, with no conflict", () => {
    expect(mergeRange("^1.1.0", "^1.1.0")).toEqual({ range: "^1.1.0" });
  });
});

describe("materializeLibraries", () => {
  it("writes the home manifest and installs what the clone declares", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "^1.1.0" });
    const home = homeFor(sourceDir);
    const install = fakeInstaller();

    const results = materializeLibraries(sourceDir, home, () => {}, install);

    expect(install.calls).toEqual([home]);
    expect(results).toEqual([{ specifier: "@intisy-ai/core", status: "installed", detail: "^1.1.0" }]);
    const manifest = JSON.parse(readFileSync(join(home, "package.json"), "utf8")) as {
      private: boolean;
      dependencies: Record<string, string>;
    };
    expect(manifest.private).toBe(true);
    expect(manifest.dependencies).toEqual({ "@intisy-ai/core": "^1.1.0" });
  });

  it("puts the library where Node resolves it from a deployed bundle", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "^1.1.0" });
    const home = homeFor(sourceDir);
    materializeLibraries(sourceDir, home, () => {}, fakeInstaller());
    expect(existsSync(join(home, "node_modules", "@intisy-ai", "core", "package.json"))).toBe(true);
  });

  it("does not install again when the manifest already asks for these ranges and they are present", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "^1.1.0" });
    const home = homeFor(sourceDir);
    const install = fakeInstaller();

    materializeLibraries(sourceDir, home, () => {}, install);
    const results = materializeLibraries(sourceDir, home, () => {}, install);

    expect(install.calls).toHaveLength(1);
    expect(results).toEqual([{ specifier: "@intisy-ai/core", status: "current", detail: "^1.1.0" }]);
  });

  it("installs again when the manifest is satisfied but the store was emptied", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "^1.1.0" });
    const home = homeFor(sourceDir);
    const install = fakeInstaller();

    materializeLibraries(sourceDir, home, () => {}, install);
    rmSync(sharedStoreDir(home), { recursive: true, force: true });
    materializeLibraries(sourceDir, home, () => {}, install);

    expect(install.calls).toHaveLength(2);
  });

  it("keeps a second clone from downgrading a slot the first brought forward", () => {
    const ahead = makeClone({ "@intisy-ai/core": "^1.1.0" });
    const home = homeFor(ahead);
    const install = fakeInstaller();
    materializeLibraries(ahead, home, () => {}, install);

    const behind = join(ahead, "..", "behind");
    mkdirSync(behind, { recursive: true });
    writeFileSync(join(behind, "package.json"), JSON.stringify({ name: "behind", dependencies: { "@intisy-ai/core": "^1.0.0" } }));
    materializeLibraries(behind, home, () => {}, install);

    const manifest = JSON.parse(readFileSync(join(home, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(manifest.dependencies["@intisy-ai/core"]).toBe("^1.1.0");
  });

  it("reports a cross-major disagreement between two clones rather than hiding it", () => {
    const first = makeClone({ "@intisy-ai/core": "^1.1.0" });
    const home = homeFor(first);
    const install = fakeInstaller();
    materializeLibraries(first, home, () => {}, install);

    const second = join(first, "..", "second");
    mkdirSync(second, { recursive: true });
    writeFileSync(join(second, "package.json"), JSON.stringify({ name: "second", dependencies: { "@intisy-ai/core": "^2.0.0" } }));

    const logged: string[] = [];
    const results = materializeLibraries(second, home, (message) => logged.push(message), install);

    expect(results[0]?.status).toBe("conflict");
    expect(logged.join("\n")).toContain("different majors");
  });

  it("accumulates a second clone's different library beside the first's", () => {
    const first = makeClone({ "@intisy-ai/core": "^1.1.0" });
    const home = homeFor(first);
    const install = fakeInstaller();
    materializeLibraries(first, home, () => {}, install);

    const second = join(first, "..", "second");
    mkdirSync(second, { recursive: true });
    writeFileSync(join(second, "package.json"), JSON.stringify({ name: "second", dependencies: { "@intisy-ai/core-auth": "^1.1.0" } }));
    materializeLibraries(second, home, () => {}, install);

    const manifest = JSON.parse(readFileSync(join(home, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(Object.keys(manifest.dependencies).sort()).toEqual(["@intisy-ai/core", "@intisy-ai/core-auth"]);
  });

  it("reports a failed install rather than claiming the store is filled", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "^1.1.0" });
    const home = homeFor(sourceDir);
    const logged: string[] = [];

    const results = materializeLibraries(sourceDir, home, (message) => logged.push(message), () => {
      throw new Error("offline");
    });

    expect(results).toEqual([{ specifier: "@intisy-ai/core", status: "conflict", detail: "install failed: offline" }]);
    expect(logged.join("\n")).toContain("offline");
  });

  it("does nothing at all for a clone that declares no libraries", () => {
    const sourceDir = makeClone({});
    const home = homeFor(sourceDir);
    const install = fakeInstaller();

    expect(materializeLibraries(sourceDir, home, () => {}, install)).toEqual([]);
    expect(install.calls).toEqual([]);
    expect(existsSync(join(home, "package.json"))).toBe(false);
  });
});

describe("dropLibrary", () => {
  it("removes the entry and re-runs the install so npm prunes it", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "^1.1.0", "@intisy-ai/api": "^1.0.2" });
    const home = homeFor(sourceDir);
    const install = fakeInstaller();
    materializeLibraries(sourceDir, home, () => {}, install);

    expect(dropLibrary("@intisy-ai/api", home, () => {}, install)).toBe(true);

    const manifest = JSON.parse(readFileSync(join(home, "package.json"), "utf8")) as { dependencies: Record<string, string> };
    expect(Object.keys(manifest.dependencies)).toEqual(["@intisy-ai/core"]);
    expect(install.calls).toHaveLength(2);
  });

  it("reports nothing dropped for a library the home never asked for", () => {
    const sourceDir = makeClone({ "@intisy-ai/core": "^1.1.0" });
    const home = homeFor(sourceDir);
    const install = fakeInstaller();
    materializeLibraries(sourceDir, home, () => {}, install);

    expect(dropLibrary("@intisy-ai/core-proxy", home, () => {}, install)).toBe(false);
    expect(install.calls).toHaveLength(1);
  });
});

describe("pruneAbandonedPluginStore", () => {
  function makeHome(): { home: string; pluginDir: string } {
    const home = makeWorkDir();
    const pluginDir = join(home, "plugin");
    mkdirSync(pluginDir, { recursive: true });
    return { home, pluginDir };
  }

  function writeStore(dir: string): void {
    mkdirSync(join(dir, "@intisy-ai", "core"), { recursive: true });
    writeFileSync(join(dir, "@intisy-ai", "core", "package.json"), "{}");
  }

  it("removes the abandoned plugin-directory store once the real store is populated", () => {
    const { home, pluginDir } = makeHome();
    writeStore(join(pluginDir, "node_modules"));
    writeStore(sharedStoreDir(home));

    pruneAbandonedPluginStore(pluginDir, home);

    expect(existsSync(join(pluginDir, "node_modules"))).toBe(false);
  });

  it("logs the removal through the provided writeLog", () => {
    const { home, pluginDir } = makeHome();
    writeStore(join(pluginDir, "node_modules"));
    writeStore(sharedStoreDir(home));

    const logged: string[] = [];
    pruneAbandonedPluginStore(pluginDir, home, (message) => logged.push(message));

    expect(logged.join("\n")).toContain("Removed abandoned library store");
  });

  it("keeps the abandoned store while the real one is still empty, so a home is never left with none", () => {
    const { home, pluginDir } = makeHome();
    writeStore(join(pluginDir, "node_modules"));
    mkdirSync(sharedStoreDir(home), { recursive: true });

    pruneAbandonedPluginStore(pluginDir, home);

    expect(existsSync(join(pluginDir, "node_modules"))).toBe(true);
  });

  it("never touches the real store", () => {
    const { home, pluginDir } = makeHome();
    writeStore(join(pluginDir, "node_modules"));
    writeStore(sharedStoreDir(home));

    pruneAbandonedPluginStore(pluginDir, home);

    expect(existsSync(join(sharedStoreDir(home), "@intisy-ai", "core", "package.json"))).toBe(true);
  });

  it("reports a locked directory as an error instead of failing the caller's deploy", () => {
    const { home, pluginDir } = makeHome();
    writeStore(join(pluginDir, "node_modules"));
    writeStore(sharedStoreDir(home));
    rmSyncFailure = new Error("EBUSY: resource busy or locked");

    const errors: string[] = [];
    expect(() => pruneAbandonedPluginStore(pluginDir, home, (message, isError) => {
      if (isError) errors.push(message);
    })).not.toThrow();
    expect(errors.join("\n")).toContain("EBUSY");
  });

  it("does nothing when there is no abandoned store to begin with", () => {
    const { home, pluginDir } = makeHome();
    writeStore(sharedStoreDir(home));

    expect(() => pruneAbandonedPluginStore(pluginDir, home)).not.toThrow();
  });
});
