import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import vm from "node:vm";

const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../src/content/contextEstimate.ts", import.meta.url))],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false
});
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports });
const { estimateVisibleContext } = module.exports;

assert.deepEqual(JSON.parse(JSON.stringify(estimateVisibleContext(120, 35))), {
  estimatedCurrentContextTokens: 155,
  contextPressureTier: "unknown"
});
assert.deepEqual(JSON.parse(JSON.stringify(estimateVisibleContext(120, null))), {
  estimatedCurrentContextTokens: null,
  contextPressureTier: "unknown"
}, "an unknown attachment contribution must not collapse to a visible-text subtotal");

const contentSource = await readFile(new URL("../src/content/index.ts", import.meta.url), "utf8");
assert.ok(/visibleMessages\.length > 0 \|\| attachments\.length > 0/.test(contentSource), "attachments alone must count as content for the overlay");
assert.ok(/estimateVisibleContext\(visibleTokens, draftBreakdown\.total\)/.test(contentSource), "content must preserve a null total when adding visible tokens");
assert.ok(/visibleEstimate\.estimatedCurrentContextTokens\s*=== null\s*\?\s*"Unknown"/.test(contentSource), "the overlay must show unknown instead of a partial count");
assert.ok(/contextPressureTier: visibleEstimate\.contextPressureTier/.test(contentSource), "context pressure must stay unknown while hidden context is unobservable");

console.log("context-unknown-check=pass");
