import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

mkdirSync(dist, { recursive: true });

const banner = `// Sweeps Relief Browser Guard — bundled ${new Date().toISOString()}\n`;

async function bundle() {
  const common = {
    bundle: true,
    platform: "browser",
    format: "esm",
    target: "chrome120",
    sourcemap: true,
    logLevel: "info",
    banner: { js: banner },
  };

  const entries = [
    { src: "src/background.ts", out: "background.js" },
    { src: "src/content.ts", out: "content.js" },
    { src: "src/popup/popup.ts", out: "popup.js" },
    { src: "src/options/options.ts", out: "options.js" },
  ];

  for (const e of entries) {
    await esbuild.build({
      ...common,
      entryPoints: [join(root, e.src)],
      outfile: join(dist, e.out),
      loader: { ".json": "json" },
    });
  }
}

await bundle();

const manifest = readFileSync(join(root, "src/manifest.json"), "utf8");
writeFileSync(join(dist, "manifest.json"), manifest);
copyFileSync(join(root, "src/popup/popup.html"), join(dist, "popup.html"));
copyFileSync(join(root, "src/options/options.html"), join(dist, "options.html"));

console.log("Built to", dist);
