import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await esbuild.build({
  entryPoints: [join(root, "scripts/manual-harness.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: join(root, "scripts/manual-harness.bundle.mjs"),
  sourcemap: true,
  packages: "bundle",
});

console.log("Wrote scripts/manual-harness.bundle.mjs");
