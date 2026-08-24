import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deployBundle, fetchRepo, repoHead, submoduleTree } from "./plugin-repo.js";
import { deployedIdFor, deployEntryFile, readCloneManifest, syncManifestSidecar } from "./plugin-manifest.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "core-plugin-repo-"));
});

afterEach(() => {
  try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
});

function write(relative: string, body: string): string {
  const target = join(root, relative);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, body, "utf8");
  return target;
}

function clone(name: string, pkg: Record<string, unknown> | null, manifest: Record<string, unknown> | null): string {
  const dir = join(root, "repos", name);
  mkdirSync(dir, { recursive: true });
  if (pkg) writeFileSync(join(dir, "package.json"), JSON.stringify(pkg), "utf8");
  if (manifest) writeFileSync(join(dir, "plugin.json"), JSON.stringify(manifest), "utf8");
  return dir;
}

describe("submoduleTree", () => {
  it("lists every submodule the clone declares, in the order declared", () => {
    write("clone/.gitmodules", '[submodule "core"]\n\tpath = core\n\turl = x\n[submodule "core-auth"]\n\tpath = core-auth\n\turl = y\n');
    expect(submoduleTree(join(root, "clone"))).toEqual(["core", "core-auth"]);
  });

  // A library carries libraries of its own, and each has a build output the clone needs. A
  // one-level read is what left those out of the copy-back.
  it("finds nested submodules as paths relative to the clone", () => {
    write("clone/.gitmodules", '[submodule "core"]\n\tpath = core\n\turl = x\n');
    write("clone/core/.gitmodules", '[submodule "api"]\n\tpath = api\n\turl = y\n');
    expect(submoduleTree(join(root, "clone"))).toEqual(["core", join("core", "api")]);
  });

  it("reports none for a clone that declares none", () => {
    mkdirSync(join(root, "clone"), { recursive: true });
    expect(submoduleTree(join(root, "clone"))).toEqual([]);
  });
});

describe("deployEntryFile", () => {
  it("asks the manifest first, since that is what states the module a host imports", () => {
    expect(deployEntryFile({ main: "dist/index.js", pluginEntry: "dist/plugin.js" }, { id: "x", entry: "dist/declared.js" } as never))
      .toBe("dist/declared.js");
  });

  it("prefers a self-contained bundle over a multi-file main", () => {
    expect(deployEntryFile({ main: "dist/index.js", pluginEntry: "dist/plugin.js" })).toBe("dist/plugin.js");
  });

  it("falls back to main, then to index.js", () => {
    expect(deployEntryFile({ main: "dist/index.js" })).toBe("dist/index.js");
    expect(deployEntryFile({})).toBe("index.js");
  });
});

describe("readCloneManifest", () => {
  it("refuses a manifest that names nothing", () => {
    const dir = clone("nameless", null, { entry: "dist/plugin.js" });
    expect(readCloneManifest(dir)).toBeNull();
  });

  it("reports the declared id as the deployed one, and the directory name otherwise", () => {
    clone("declared", null, { id: "real-id", api: 1, entry: "dist/plugin.js" });
    clone("undeclared", null, null);
    expect(deployedIdFor(join(root, "repos"), "declared")).toBe("real-id");
    expect(deployedIdFor(join(root, "repos"), "undeclared")).toBe("undeclared");
  });
});

describe("syncManifestSidecar", () => {
  it("removes a sidecar left behind by a clone that no longer declares one", () => {
    const dir = clone("gone", null, null);
    const plugins = join(root, "plugin");
    mkdirSync(plugins, { recursive: true });
    writeFileSync(join(plugins, "gone.json"), "{}", "utf8");
    expect(syncManifestSidecar(dir, plugins, "gone")).toBe("removed");
    expect(existsSync(join(plugins, "gone.json"))).toBe(false);
  });
});

describe("deployBundle", () => {
  it("copies the declared entry, writes the sidecar, stamps the commit and marks the directory ESM", async () => {
    const dir = clone("widget", { main: "dist/plugin.js" }, { id: "widget", api: 1, entry: "dist/plugin.js" });
    write("repos/widget/dist/plugin.js", "// built");
    const plugins = join(root, "plugin");

    const result = await deployBundle(dir, plugins, "widget", { head: "abc123" });

    expect(result).toEqual({ ok: true, deployedId: "widget", deployedFile: join(plugins, "widget.js") });
    expect(readFileSync(join(plugins, "widget.js"), "utf8")).toBe("// built");
    expect(JSON.parse(readFileSync(join(plugins, "widget.json"), "utf8")).id).toBe("widget");
    expect(readFileSync(join(plugins, "widget.sha"), "utf8")).toBe("abc123");
    expect(JSON.parse(readFileSync(join(plugins, "package.json"), "utf8")).type).toBe("module");
  });

  it("names the artifacts after the manifest's id, not the directory", async () => {
    const dir = clone("checkout-name", { main: "index.js" }, { id: "real-id", api: 1 });
    write("repos/checkout-name/index.js", "// built");
    const result = await deployBundle(dir, join(root, "plugin"), "checkout-name");
    expect(result.deployedId).toBe("real-id");
    expect(existsSync(join(root, "plugin", "real-id.js"))).toBe(true);
  });

  it("falls back to dist by basename rather than re-joining a dist-prefixed main", async () => {
    const dir = clone("prefixed", { main: "dist/plugin.js" }, null);
    write("repos/prefixed/dist/plugin.js", "// built");
    await deployBundle(dir, join(root, "plugin"), "prefixed");
    expect(readFileSync(join(root, "plugin", "prefixed.js"), "utf8")).toBe("// built");
  });

  it("reports failure and copies nothing when the build produced no entry", async () => {
    const dir = clone("unbuilt", { main: "dist/plugin.js" }, null);
    const result = await deployBundle(dir, join(root, "plugin"), "unbuilt");
    expect(result.ok).toBe(false);
    expect(existsSync(join(root, "plugin", "unbuilt.js"))).toBe(false);
  });

  it("lets a host release the old module before the entry is overwritten", async () => {
    const dir = clone("held", { main: "index.js" }, null);
    write("repos/held/index.js", "// new");
    const plugins = join(root, "plugin");
    mkdirSync(plugins, { recursive: true });
    writeFileSync(join(plugins, "held.js"), "// old", "utf8");

    const seen: string[] = [];
    await deployBundle(dir, plugins, "held", {
      beforeOverwrite: (file) => { seen.push(readFileSync(file, "utf8")); },
    });

    expect(seen).toEqual(["// old"]);
    expect(readFileSync(join(plugins, "held.js"), "utf8")).toBe("// new");
  });

  it("writes the sidecar even when there is nothing to copy", async () => {
    const dir = clone("declared-only", { main: "dist/plugin.js" }, { id: "declared-only", api: 1 });
    await deployBundle(dir, join(root, "plugin"), "declared-only");
    expect(existsSync(join(root, "plugin", "declared-only.json"))).toBe(true);
  });
});

// Several git spawns per pass, which under a parallel suite outruns the default per-test budget.
describe("fetchRepo", { timeout: 60_000 }, () => {
  function origin(): string {
    const dir = join(root, "origin");
    mkdirSync(dir, { recursive: true });
    const git = (command: string) => execSync(command, { cwd: dir, windowsHide: true, stdio: "pipe" });
    git("git init -q -b main");
    git("git config user.email a@b.c");
    git("git config user.name tester");
    writeFileSync(join(dir, "README.md"), "one", "utf8");
    git("git add -A");
    git('git commit -q -m "one"');
    return dir;
  }

  it("clones a repository that is not there yet, and reports the change", () => {
    const url = origin().replace(/\\/g, "/");
    const repos = join(root, "repos");
    const result = fetchRepo(repos, "widget", url);
    expect(result).toEqual({ ok: true, changed: true });
    expect(readFileSync(join(repos, "widget", "README.md"), "utf8")).toBe("one");
  });

  it("reports no change on a second pass over an unmoved remote", () => {
    const url = origin().replace(/\\/g, "/");
    const repos = join(root, "repos");
    fetchRepo(repos, "widget", url, { ref: "main" });
    expect(fetchRepo(repos, "widget", url, { ref: "main" })).toEqual({ ok: true, changed: false });
  });

  it("brings a moved remote forward", () => {
    const dir = origin();
    const url = dir.replace(/\\/g, "/");
    const repos = join(root, "repos");
    fetchRepo(repos, "widget", url, { ref: "main" });

    writeFileSync(join(dir, "README.md"), "two", "utf8");
    execSync("git add -A", { cwd: dir, windowsHide: true, stdio: "pipe" });
    execSync('git commit -q -m "two"', { cwd: dir, windowsHide: true, stdio: "pipe" });

    expect(fetchRepo(repos, "widget", url, { ref: "main" })).toEqual({ ok: true, changed: true });
    expect(readFileSync(join(repos, "widget", "README.md"), "utf8")).toBe("two");
    expect(repoHead(join(repos, "widget"))).toHaveLength(40);
  });

  it("reports failure rather than throwing when the repository cannot be reached", () => {
    expect(fetchRepo(join(root, "repos"), "absent", join(root, "no-such-repo").replace(/\\/g, "/")))
      .toEqual({ ok: false, changed: false });
  });
});
