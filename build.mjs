// One self-contained ESM bundle. Consumers embed core as a submodule and inline it
// (sibling imports must be bundled; plain tsc output fails at load). The config CLI
// (maybeRunConfigCli) ships inside this bundle, so a plugin's own deployed file acts
// as its config CLI, with no separate artifact to deploy.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { build } from "esbuild";

// The TeaVM bundle stays external and is copied beside the output instead of being inlined: it is
// generated build output shipped in dist/generated, and esbuild has no reason to walk 666 KB of
// machine-written ES2015 on every build.
const TEAVM = "./generated/core.teavm.js";

const common = { bundle: true, platform: "node", format: "esm", target: "node20", logLevel: "info",
  external: [TEAVM] };

await build({ ...common, entryPoints: ["src/index.ts"], outfile: "dist/index.js" });

// The test kit ships as its own entry so it stays out of the runtime barrel: a plugin bundling
// `@intisy-ai/core` never pulls vitest in, and vitest stays external here because a test runner
// must be the consumer's own instance.
await build({ ...common, entryPoints: ["src/testing.ts"], outfile: "dist/testing.js",
  external: [TEAVM, "vitest"] });

// copy-generated.mjs takes only .js, and the shared runtime's manifest is the one piece of
// generated output that is not code: a consumer's Gradle build reads it to learn what the runtime
// carries, so it has to reach dist/ too.
const MANIFEST = "generated/runtime.manifest.json";
await mkdir(dirname(join("dist", MANIFEST)), { recursive: true });
await copyFile(join("src", MANIFEST), join("dist", MANIFEST));

console.log("Bundled core -> dist/index.js, dist/testing.js, and staged the shared runtime");
