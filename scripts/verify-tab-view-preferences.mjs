import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import vm from "node:vm";

const entry = fileURLToPath(new URL("../src/content/overlayVisibility.ts", import.meta.url));
const output = await build({
  entryPoints: [entry],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false
});
const module = { exports: {} };
vm.runInNewContext(output.outputFiles[0].text, { module, exports: module.exports });
const { isOverlayInitiallyVisible } = module.exports;

assert.equal(isOverlayInitiallyVisible({ siteEnabled: true, preferences: { showOverlay: true } }), true);
assert.equal(isOverlayInitiallyVisible({ siteEnabled: false, preferences: { showOverlay: true } }), false);
assert.equal(isOverlayInitiallyVisible({ siteEnabled: true, preferences: { showOverlay: false } }), false);
assert.equal(isOverlayInitiallyVisible(undefined), true, "missing tab settings preserve the existing visible default");

const contentSource = await readFile(new URL("../src/content/index.ts", import.meta.url), "utf8");
assert.match(contentSource, /isOverlayInitiallyVisible\(tabView\)/, "content initialization must use the tab view visibility settings");
assert.match(contentSource, /container\.style\.display = overlayVisible \? "" : "none"/, "disabled settings must hide the mounted overlay");

console.log("tab-view-preferences-check=pass");
