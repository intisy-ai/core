// One self-contained ESM bundle. Consumers embed core as a submodule and inline it
// (sibling imports must be bundled; plain tsc output fails at load). The config CLI
// (maybeRunConfigCli) ships inside this bundle, so a plugin's own deployed file acts
// as its config CLI, with no separate artifact to deploy.
import { build } from "esbuild";

await build({ bundle: true, platform: "node", format: "esm", target: "node20", logLevel: "info",
  entryPoints: ["src/index.ts"], outfile: "dist/index.js" });

console.log("Bundled core -> dist/index.js");
