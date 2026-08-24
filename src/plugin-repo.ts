import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { deployEntryFile, readCloneManifest, syncManifestSidecar } from "./plugin-manifest.js";

/** Where a caller wants to hear about a step it did not run itself. */
export type RepoLog = (message: string, isError?: boolean) => void;

const NO_LOG: RepoLog = () => { /* a caller that wants no narration says nothing */ };

const GIT_TIMEOUT_MS = 120_000;
const BUILD_TIMEOUT_MS = 300_000;

export interface FetchOptions {
  /** Branch to track. Absent follows the repository's own default branch. */
  ref?: string;
  /** Exact commit to sit at, which wins over `ref`. */
  commit?: string;
  /** Let git write its transfer progress to this process's stderr, so a host can show it live. */
  progress?: boolean;
  timeoutMs?: number;
  log?: RepoLog;
}

export interface FetchResult {
  ok: boolean;
  /** Whether the working tree moved, so a caller knows whether anything downstream must rerun. */
  changed: boolean;
}

/** The commit a clone sits at, or "" when it is not a repository or git refuses. */
export function repoHead(dir: string): string {
  try {
    return execSync("git rev-parse HEAD", { windowsHide: true, cwd: dir }).toString().trim();
  } catch {
    return "";
  }
}

export function runGit(command: string, cwd: string, opts: { progress?: boolean; timeoutMs?: number; log?: RepoLog } = {}): boolean {
  const log = opts.log ?? NO_LOG;
  log(`Executing git: ${command} in ${cwd}`);
  try {
    execSync(command, {
      windowsHide: true,
      cwd,
      stdio: opts.progress ? ["ignore", "pipe", "inherit"] : "pipe",
      timeout: opts.timeoutMs ?? GIT_TIMEOUT_MS,
      // Never let a credential helper or git itself stop for input: nothing is watching.
      env: { ...process.env, GCM_INTERACTIVE: "never", GIT_TERMINAL_PROMPT: "0" },
    });
    return true;
  } catch (error: unknown) {
    const failure = error as { message: string; stderr?: Buffer };
    const stderr = failure.stderr ? failure.stderr.toString().trim() : "";
    log(`Git error in ${cwd}: ${failure.message} | stderr: ${stderr}`, true);
    return false;
  }
}

/**
 * Puts a repository's working tree at the requested commit, cloning it first if it is absent.
 *
 * @remarks
 * Carries no policy about WHEN to do this: no interval, no channel resolution, no pin. A caller
 * that wants those decides them and passes the answer in.
 */
export function fetchRepo(reposDir: string, id: string, url: string, opts: FetchOptions = {}): FetchResult {
  const log = opts.log ?? NO_LOG;
  const git = { progress: opts.progress, timeoutMs: opts.timeoutMs, log };
  const progressFlag = opts.progress ? " --progress" : "";
  const branchFlag = opts.ref ? ` --branch ${opts.ref}` : "";
  const targetDir = path.join(reposDir, id);
  let changed = false;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(reposDir, { recursive: true });
    if (!runGit(`git clone${progressFlag}${branchFlag} ${url} ${id}`, reposDir, git)) {
      return { ok: false, changed: false };
    }
    changed = true;
  } else {
    const before = repoHead(targetDir);
    runGit(`git fetch origin${progressFlag}`, targetDir, git);
    if (opts.commit) {
      runGit(`git checkout ${opts.commit}`, targetDir, git);
    } else if (opts.ref) {
      runGit(`git checkout ${opts.ref}`, targetDir, git);
      // A force-pushed branch would leave a --ff-only pull refusing and the clone silently behind.
      runGit(`git reset --hard origin/${opts.ref}`, targetDir, git);
    } else {
      runGit("git checkout main || git checkout master", targetDir, git);
      runGit("git reset --hard @{upstream}", targetDir, git);
    }
    if (before !== repoHead(targetDir)) changed = true;
  }
  return { ok: true, changed };
}

const COPY_RETRIES = 12;
const COPY_RETRY_DELAY_MS = 250;

function sleepSync(ms: number): void {
  const until = Date.now() + ms;
  while (Date.now() < until) { /* the build is synchronous throughout; nothing to yield to */ }
}

function copyFileWithRetry(from: string, to: string): void {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.copyFileSync(from, to);
      return;
    } catch (error: unknown) {
      // On Windows a file a running process has open cannot be overwritten. A handler another
      // process imported is exactly that, so wait for it to let go rather than leaving the built
      // artifact behind.
      const code = (error as { code?: string }).code;
      if (attempt >= COPY_RETRIES || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw error;
      sleepSync(COPY_RETRY_DELAY_MS);
    }
  }
}

// One file at a time, so a single locked artifact cannot abandon the rest of the tree
// half-copied the way a recursive copy does.
function copyTree(from: string, to: string, id: string, failures: string[]): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyTree(source, target, id, failures);
      continue;
    }
    try {
      copyFileWithRetry(source, target);
    } catch (error: unknown) {
      failures.push(`${entry.name} (${(error as { message: string }).message})`);
    }
  }
}

export interface BuildOptions {
  timeoutMs?: number;
  log?: RepoLog;
}

/**
 * Installs a clone's dependencies and runs its build, leaving the outputs in the clone.
 *
 * @remarks
 * `npm install` creates `node_modules/.bin` symlinks, which fail on filesystems without symlink
 * support, so the work happens in a temp copy and only the outputs are copied back.
 */
export function buildRepo(id: string, sourceDir: string, opts: BuildOptions = {}): void {
  const log = opts.log ?? NO_LOG;
  const timeout = opts.timeoutMs ?? BUILD_TIMEOUT_MS;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `plugin-build-${id}-`));
  try {
    fs.cpSync(sourceDir, tempDir, {
      recursive: true,
      filter: (src) => {
        const name = path.basename(src);
        return name !== ".git" && name !== "node_modules";
      },
    });

    log(`Running npm install for ${id}`);
    execSync("npm install", { windowsHide: true, cwd: tempDir, stdio: "pipe", timeout });
    log(`Finished npm install for ${id}`);

    const pkg = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf8")) as { scripts?: { build?: string } };
    if (pkg.scripts?.build) {
      // Said BEFORE the build, not only after: this is the longest step by far, and without it a
      // progress readout sits on the previous step's label for the whole thing.
      log(`Running npm run build for ${id}`);
      execSync("npm run build", { windowsHide: true, cwd: tempDir, stdio: "pipe", timeout });
      log(`Finished npm run build for ${id}`);
    } else {
      log(`Skipped npm run build for ${id} (no build script found)`);
    }

    const failures: string[] = [];
    const builtDir = path.join(tempDir, "dist");
    if (fs.existsSync(builtDir)) {
      log(`Copying build output dist/ for ${id}`);
      copyTree(builtDir, path.join(sourceDir, "dist"), id, failures);
    }
    if (failures.length > 0) {
      throw new Error(`could not write ${failures.length} built file(s) for ${id}: ${failures.join(", ")}`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export interface DeployOptions {
  /** Stamp the deployed artifact with this commit, so a later pass can tell whether it is current. */
  head?: string;
  /** Run before the entry file is overwritten, for a host that must let go of the old module. */
  beforeOverwrite?: (deployedFile: string) => Promise<void> | void;
  log?: RepoLog;
}

export interface DeployResult {
  ok: boolean;
  /** The id the artifacts are named after, which is the manifest's where a clone declares one. */
  deployedId: string;
  deployedFile: string;
}

/**
 * Puts a clone's built entry file and its manifest where a host loads plugins from.
 *
 * @remarks
 * The whole of what makes a built clone loadable, and nothing about when to do it: a caller decides
 * whether anything changed, what to activate afterwards, and what else a home needs. The sidecar is
 * written even when the copy is skipped, since a host answers every identity question from it.
 */
export async function deployBundle(sourceDir: string, executionPath: string, id: string, opts: DeployOptions = {}): Promise<DeployResult> {
  const log = opts.log ?? NO_LOG;
  const manifest = readCloneManifest(sourceDir);
  const deployedId = manifest?.id ?? id;
  const deployedFile = path.join(executionPath, `${deployedId}.js`);

  syncManifestSidecar(sourceDir, executionPath, deployedId, log);

  let entryFile = "index.js";
  const packageJsonPath = path.join(sourceDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      entryFile = deployEntryFile(JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { main?: string; pluginEntry?: string }, manifest);
    } catch { /* an unreadable package.json leaves the default */ }
  }

  // `main` frequently already carries the dist/ prefix, so it is resolved against the clone
  // DIRECTLY first. Only fall back to dist/, and by BASENAME, so "dist/plugin.js" is never
  // re-joined onto dist/ into a double-nested path that can pick up a stale older layout.
  let source = path.join(sourceDir, entryFile);
  if (!fs.existsSync(source)) {
    const base = path.basename(entryFile);
    if (fs.existsSync(path.join(sourceDir, "dist", base))) source = path.join(sourceDir, "dist", base);
    else if (fs.existsSync(path.join(sourceDir, "dist", "index.js"))) source = path.join(sourceDir, "dist", "index.js");
  }
  if (!fs.existsSync(source)) {
    log(`Skipping deploy for ${id}: built file not found at ${source}`, true);
    return { ok: false, deployedId, deployedFile };
  }

  fs.mkdirSync(executionPath, { recursive: true });
  // Deployed plugin files are ESM bundles. Without a package.json declaring the directory ESM,
  // Node re-parses each on import and warns.
  try {
    const marker = path.join(executionPath, "package.json");
    if (!fs.existsSync(marker)) fs.writeFileSync(marker, JSON.stringify({ type: "module" }, null, 2), "utf8");
  } catch { /* non-fatal */ }

  await opts.beforeOverwrite?.(deployedFile);
  try {
    log(`Running copy for ${id}`);
    fs.copyFileSync(source, deployedFile);
    if (opts.head) {
      try { fs.writeFileSync(path.join(executionPath, `${deployedId}.sha`), opts.head, "utf8"); } catch { /* non-fatal */ }
    }
    log(`Finished copy for ${id}`);
    return { ok: true, deployedId, deployedFile };
  } catch (error: unknown) {
    log(`Copy failed for ${id}: ${(error as { message: string }).message}`, true);
    return { ok: false, deployedId, deployedFile };
  }
}
