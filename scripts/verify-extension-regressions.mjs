import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [
  "verify-regression-integration.mjs",
  "verify-audit-report.mjs",
  "verify-capture-state.mjs",
  "verify-context-unknown.mjs",
  "verify-copy-shorter.mjs",
  "verify-extension-runtime.mjs",
  "verify-live-capture.mjs",
  "verify-package-preflight.mjs",
  "verify-submission-flow.mjs",
  "verify-tab-view-preferences.mjs",
  "verify-tokenizer-wiring.mjs",
  "verify-quota-evidence.mjs",
  "verify-overlay-window.mjs",
  "verify-reset-predictor.mjs",
  "verify-adversarial-stress.mjs"
];

for (const check of checks) {
  console.log(`regression-check=${check}`);
  const result = spawnSync(process.execPath, [path.join(root, "scripts", check)], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    console.error(`regression-check-failed=${check}`);
    break;
  }
}

if (process.exitCode === undefined) {
  console.log(`regression-checks=pass; count=${checks.length}`);
}
