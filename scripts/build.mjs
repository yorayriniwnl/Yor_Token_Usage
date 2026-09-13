import { build } from "esbuild";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const targets = [
  {
    entryPoints: [resolve(root, "src/background/index.ts")],
    outfile: resolve(root, "background/service-worker.js"),
    format: "esm",
    target: "es2022"
  },
  {
    entryPoints: [resolve(root, "src/content/index.ts")],
    outfile: resolve(root, "content/index.js"),
    format: "iife",
    target: "es2022"
  },
  {
    entryPoints: [resolve(root, "src/measurement/accuracy-engine.ts")],
    outfile: resolve(root, "content/accuracy-engine.js"),
    format: "iife",
    target: "es2022"
  },
  {
    entryPoints: [resolve(root, "src/measurement/gpt-tokenizer.ts")],
    outfile: resolve(root, "content/gpt-tokenizer.js"),
    format: "iife",
    target: "es2022"
  },
  {
    entryPoints: [resolve(root, "src/overlay/overlay-position.ts")],
    outfile: resolve(root, "content/overlay-position.js"),
    format: "iife",
    target: "es2022"
  },
  {
    entryPoints: [resolve(root, "src/popup/index.ts")],
    outfile: resolve(root, "popup/index.js"),
    format: "esm",
    target: "es2022"
  },
  {
    entryPoints: [resolve(root, "src/dashboard/index.ts")],
    outfile: resolve(root, "dashboard/index.js"),
    format: "esm",
    target: "es2022"
  },
  {
    entryPoints: [resolve(root, "src/settings/index.ts")],
    outfile: resolve(root, "settings/index.js"),
    format: "esm",
    target: "es2022"
  }
];

console.log("Building Yor Token Usage extension bundles...");

await Promise.all(
  targets.map(async (target) => {
    const name = target.outfile.split(/[\\/]/).slice(-2).join("/");
    await build({
      ...target,
      bundle: true,
      external: target.outfile.endsWith("gpt-tokenizer.js") ? [] : ["gpt-tokenizer"],
      sourcemap: false,
      legalComments: "none",
      minify: false,
      logOverride: {
        "commonjs-variable-in-esm": "silent"
      }
    });
    console.log(`Bundled ${name}`);
  })
);

console.log("Build complete.");
process.exit(0);
