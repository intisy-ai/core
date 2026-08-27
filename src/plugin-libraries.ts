import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// A library a plugin imports by name and does not inline. The specifier is what the plugin's
// built bundle imports; the range is what the clone asks the registry for.
/** One library materialised in the shared store of a home. */
export interface SharedLibrary {
  /** The package name. */
  specifier: string;
  /** The version range this home asks for. */
  range: string;
}

const SCOPE = "@intisy-ai";

const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;

// The store sits at the HOME's root rather than inside the deployed-plugin directory:
// Node resolves a bare specifier by walking up from the importing file, and two
// consumers import from different depths. The deployed bundle sits at
// <home>/plugin/<name>.js, while a provider's handler is loaded straight out of its
// clone at <home>/repos/<name>/dist/. Only the home root is above both.
/**
 * Where a home keeps the libraries its plugins share.
 *
 * @param configDir the home to resolve against.
 * @returns the absolute path of the shared store.
 */
export function sharedStoreDir(configDir: string): string {
  return path.join(configDir, "node_modules");
}

/**
 * The libraries a clone declares, read from its own `package.json`.
 *
 * @remarks
 * Only the DIRECT scoped dependencies, because npm resolves the rest: installing
 * `@intisy-ai/core` brings `@intisy-ai/api` along, since core declares it. A spec that is not a
 * registry range (`file:`, `link:`) is skipped rather than passed on, because it describes a path
 * in the clone and cannot describe an install into a home.
 */
export function declaredLibraries(sourceDir: string): SharedLibrary[] {
  let pkg: { dependencies?: unknown; peerDependencies?: unknown };
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(sourceDir, "package.json"), "utf8")) as typeof pkg;
  } catch {
    return [];
  }
  const libraries = new Map<string, string>();
  for (const group of [pkg.dependencies, pkg.peerDependencies]) {
    if (!group || typeof group !== "object") continue;
    for (const [specifier, range] of Object.entries(group as Record<string, unknown>)) {
      if (!specifier.startsWith(`${SCOPE}/`)) continue;
      if (typeof range !== "string" || range.length === 0) continue;
      if (/^(file|link):/.test(range)) continue;
      if (!libraries.has(specifier)) libraries.set(specifier, range);
    }
  }
  return [...libraries].map(([specifier, range]) => ({ specifier, range }));
}

interface Caret {
  major: number;
  minor: number;
  patch: number;
}

function parseCaret(range: string): Caret | null {
  const match = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(range.trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function isAbove(a: Caret, b: Caret): boolean {
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch > b.patch;
}

/** What one library range resolved to once every plugin asking for it was taken together. */
export interface MergedRange {
  /** The range that satisfies every plugin asking for this library. */
  range: string;
  /** Set when the two ranges cannot both be satisfied by one installed version. */
  conflict?: string;
}

/**
 * The one range a home's store can carry for a library that two clones both ask for.
 *
 * @remarks
 * npm holds exactly one top-level version per name, and every consumer resolves through that one
 * slot, so two asks must collapse to a single range. Two carets on the same major collapse to the
 * MORE RESTRICTIVE one, which satisfies both asks. Two different majors cannot both be satisfied:
 * that is reported rather than resolved silently, because silently picking is the last-writer-wins
 * defect this rework exists to remove. A range that is not a plain caret is not compared at all -
 * it is kept if it is already there, so a deliberate pin is never widened behind the pinner's back.
 */
export function mergeRange(existing: string | undefined, incoming: string): MergedRange {
  if (existing === undefined || existing === incoming) return { range: incoming };

  const current = parseCaret(existing);
  const next = parseCaret(incoming);
  if (!current || !next) return { range: existing, conflict: `cannot compare ${existing} with ${incoming}` };

  if (current.major !== next.major) {
    const higher = next.major > current.major ? incoming : existing;
    return { range: higher, conflict: `${existing} and ${incoming} need different majors; kept ${higher}` };
  }
  return { range: isAbove(next, current) ? incoming : existing };
}

/** What materialising a home shared libraries produced. */
export interface MaterializeResult {
  /** The package name. */
  specifier: string;
  /** Whether it was installed, was already right, or could not satisfy every asker. */
  status: "installed" | "current" | "conflict";
  /** What conflicted, when something did. */
  detail?: string;
}

/** Runs the install that fills the store. Injectable so a test never reaches the registry. */
export type StoreInstaller = (configDir: string) => void;

const npmInstall: StoreInstaller = (configDir) => {
  execFileSync("npm", ["install", "--prefix", configDir, "--omit=dev", "--no-audit", "--no-fund"], {
    windowsHide: true,
    stdio: "pipe",
    timeout: INSTALL_TIMEOUT_MS,
    shell: process.platform === "win32",
  });
};

function readHomePackage(homePackagePath: string, configDir: string): { name: string; private: true; dependencies: Record<string, string> } {
  try {
    const parsed = JSON.parse(fs.readFileSync(homePackagePath, "utf8")) as { dependencies?: Record<string, string> };
    return { name: path.basename(configDir).replace(/^\./, ""), private: true, dependencies: parsed.dependencies ?? {} };
  } catch {
    return { name: path.basename(configDir).replace(/^\./, ""), private: true, dependencies: {} };
  }
}

function isInStore(configDir: string, specifier: string): boolean {
  return fs.existsSync(path.join(sharedStoreDir(configDir), ...specifier.split("/"), "package.json"));
}

/**
 * Puts every library a clone declares into the home's shared store, so anything importing one by
 * name resolves through ordinary Node lookup.
 *
 * @remarks
 * The home's `package.json` is the store's manifest, and `npm install` is what fills it. Nothing is
 * copied out of the clone: a clone is a git checkout, and only the registry knows what
 * `@intisy-ai/core@^1.1.0` means. The install is skipped when the manifest already asks for these
 * ranges and every one of them is present, which is the common case on a repeat deploy.
 */
export function materializeLibraries(
  sourceDir: string,
  configDir: string,
  writeLog: (message: string, isError?: boolean) => void = () => {},
  install: StoreInstaller = npmInstall,
): MaterializeResult[] {
  const declared = declaredLibraries(sourceDir);
  if (declared.length === 0) return [];

  const homePackagePath = path.join(configDir, "package.json");
  const homePackage = readHomePackage(homePackagePath, configDir);
  const results: MaterializeResult[] = [];
  let manifestChanged = false;

  for (const library of declared) {
    const merged = mergeRange(homePackage.dependencies[library.specifier], library.range);
    if (merged.conflict !== undefined) {
      results.push({ specifier: library.specifier, status: "conflict", detail: merged.conflict });
      writeLog(`Library ${library.specifier}: ${merged.conflict}`, true);
    }
    if (merged.range !== homePackage.dependencies[library.specifier]) {
      homePackage.dependencies[library.specifier] = merged.range;
      manifestChanged = true;
    }
  }

  const absent = declared.filter((library) => !isInStore(configDir, library.specifier));
  if (!manifestChanged && absent.length === 0) {
    for (const library of declared) {
      if (results.some((result) => result.specifier === library.specifier)) continue;
      results.push({ specifier: library.specifier, status: "current", detail: homePackage.dependencies[library.specifier] });
    }
    return results;
  }

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(homePackagePath, `${JSON.stringify(homePackage, null, 2)}\n`, "utf8");

  try {
    install(configDir);
  } catch (e: unknown) {
    const detail = `install failed: ${(e as { message: string }).message}`;
    writeLog(`Could not fill the library store in ${configDir}: ${detail}`, true);
    for (const library of declared) {
      if (results.some((result) => result.specifier === library.specifier)) continue;
      results.push({ specifier: library.specifier, status: "conflict", detail });
    }
    return results;
  }

  for (const library of declared) {
    if (results.some((result) => result.specifier === library.specifier)) continue;
    const range = homePackage.dependencies[library.specifier];
    results.push({ specifier: library.specifier, status: "installed", detail: range });
    writeLog(`Shared ${library.specifier}@${range}`);
  }
  return results;
}

/**
 * Drops a library from the home's manifest and prunes it out of the store.
 *
 * @remarks
 * Pruning is npm's, so a library another entry still needs transitively survives being dropped
 * here, which a directory delete could not get right.
 */
export function dropLibrary(
  specifier: string,
  configDir: string,
  writeLog: (message: string, isError?: boolean) => void = () => {},
  install: StoreInstaller = npmInstall,
): boolean {
  const homePackagePath = path.join(configDir, "package.json");
  const homePackage = readHomePackage(homePackagePath, configDir);
  if (homePackage.dependencies[specifier] === undefined) return false;

  delete homePackage.dependencies[specifier];
  fs.writeFileSync(homePackagePath, `${JSON.stringify(homePackage, null, 2)}\n`, "utf8");
  try {
    install(configDir);
    writeLog(`Dropped ${specifier} from the library store`);
    return true;
  } catch (e: unknown) {
    writeLog(`Could not prune ${specifier}: ${(e as { message: string }).message}`, true);
    return false;
  }
}

// <pluginDir>/node_modules is a store this plugin wrote before the shared store moved to
// sharedStoreDir (the home root). Nothing writes that location any more, but a deployed
// bundle at <pluginDir>/<id>.js resolves the CLOSER directory first, so a stale copy left
// there silently shadows the real store forever. Removing it here makes every existing
// home self-heal on its next deploy pass.
/**
 * Removes the private library store of a plugin that is no longer deployed.
 *
 * @returns the paths removed, empty when there was nothing abandoned.
 */
export function pruneAbandonedPluginStore(
  pluginDir: string,
  configDir: string,
  writeLog: (message: string, isError?: boolean) => void = () => {},
): void {
  const abandoned = path.join(pluginDir, "node_modules");
  const realStore = sharedStoreDir(configDir);
  if (path.resolve(abandoned) === path.resolve(realStore)) return;
  if (!fs.existsSync(abandoned)) return;

  // Only prune once the real store actually has something in it: removing the abandoned
  // copy first would leave a home with no libraries at all if the real store is still empty.
  const realStorePopulated = fs.existsSync(realStore) && fs.readdirSync(realStore).length > 0;
  if (!realStorePopulated) return;

  // A locked file (Windows) must never fail the caller's deploy; retried on the next pass.
  try {
    fs.rmSync(abandoned, { recursive: true, force: true });
    writeLog(`Removed abandoned library store at ${abandoned}`);
  } catch (e: unknown) {
    writeLog(`Could not remove abandoned library store at ${abandoned}: ${(e as { message: string }).message}`, true);
  }
}
