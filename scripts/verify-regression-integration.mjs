import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [packageJson, workflow, preflight, stress, captureBrowser, releaseGate] = await Promise.all([
  readFile(path.join(root, "package.json"), "utf8").then(JSON.parse),
  readFile(path.join(root, ".github/workflows/verify.yml"), "utf8"),
  readFile(path.join(root, "scripts/verify-package-preflight.mjs"), "utf8"),
  readFile(path.join(root, "scripts/verify-adversarial-stress.mjs"), "utf8"),
  readFile(path.join(root, "scripts/verify-capture-browser.cjs"), "utf8"),
  readFile(path.join(root, "scripts/verify-extension.ps1"), "utf8")
]);

assert.equal(
  packageJson.scripts["regression:check"],
  "node scripts/verify-extension-regressions.mjs",
  "package.json must expose the regression gate"
);
assert.match(workflow, /run:\s*npm run regression:check/, "CI must run the regression gate");
assert.ok(/run:\s*npm run browser:check/.test(workflow), "CI must retain the overlay browser fixture");
assert.ok(/run:\s*npm run capture:check/.test(workflow), "CI must retain the capture browser fixture");
assert.match(releaseGate, /verify-extension-regressions\.mjs/, "the release package gate must run the regression suite");

const aggregator = await readFile(path.join(root, "scripts/verify-extension-regressions.mjs"), "utf8");
for (const check of [
  "verify-audit-report.mjs",
  "verify-capture-state.mjs",
  "verify-context-unknown.mjs",
  "verify-copy-shorter.mjs",
  "verify-extension-runtime.mjs",
  "verify-live-capture.mjs",
  "verify-package-preflight.mjs",
  "verify-regression-integration.mjs",
  "verify-submission-flow.mjs",
  "verify-tab-view-preferences.mjs",
  "verify-tokenizer-wiring.mjs",
  "verify-quota-evidence.mjs",
  "verify-overlay-window.mjs",
  "verify-reset-predictor.mjs",
  "verify-adversarial-stress.mjs"
]) {
  assert.ok(aggregator.includes(check), `the regression gate must run ${check}`);
}

assert.ok(/process\.platform\s*===\s*["']win32["']\s*\?\s*["']powershell\.exe["']\s*:\s*["']pwsh["']/.test(preflight),
  "package preflight must select the available PowerShell executable by platform");
assert.match(stress, /YOR_STRESS_VERBOSE/, "the stress suite must support opt-in verbose output");
assert.match(stress, /tabs:\s*\{[^}]*onRemoved:\s*\{\s*addListener:/s, "the stress harness must mock tabs.onRemoved");
assert.ok(/YOR_CHROME_PATH/.test(captureBrowser), "the capture browser fixture must accept an installed browser executable");
assert.ok(/YOR_TEST_HEADLESS/.test(captureBrowser), "the capture browser fixture must allow a visible browser session");

console.log("regression-integration-check=pass");
