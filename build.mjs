// One self-contained ESM bundle. Consumers embed core as a submodule and inline it
// (sibling imports must be bundled; plain tsc output fails at load). The config CLI
// (maybeRunConfigCli) ships inside this bundle, so a plugin's own deployed file acts
// as its config CLI, with no separate artifact to deploy.
import { build } from "esbuild";

const common = { bundle: true, platform: "node", format: "esm", target: "node20", logLevel: "info" };

await build({ ...common, entryPoints: ["src/index.ts"], outfile: "dist/index.js" });

// The test kit ships as its own entry so it stays out of the runtime barrel: a plugin bundling
// `@intisy-ai/core` never pulls vitest in, and vitest stays external here because a test runner
// must be the consumer's own instance.
await build({ ...common, entryPoints: ["src/testing.ts"], outfile: "dist/testing.js",
  external: ["vitest"] });

console.log("Bundled core -> dist/index.js, dist/testing.js");
