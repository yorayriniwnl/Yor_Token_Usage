import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [manifest, buildSource, report] = await Promise.all([
  readFile(new URL("../manifest.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8"),
  readFile(new URL("../docs/audit/final-adversarial-audit.md", import.meta.url), "utf8")
]);
const buildEntries = (buildSource.match(/entryPoints:\s*\[/g) ?? []).length;

assert.ok(report.includes(`| Extension version | ${manifest.version} |`), "the audit must match the live manifest version");
assert.ok(report.includes(`| Build entry points | ${buildEntries} |`), "the audit must match the current build target count");
assert.doesNotMatch(report, /10\/10 PRODUCTION-READY|100% production-ready|ZERO COMPROMISES REMAINING/i,
  "the audit must not certify the whole product without a scoped release gate");
assert.doesNotMatch(report, /7 bundles|36\/36 tests|Chromium[^\n]*PASS/i,
  "the audit must not retain stale build, backend, or browser pass counts");
assert.match(report, /unverified|not verified/i, "the audit must state its unverified scope");
assert.match(report, /ten-cycle remediation report/i, "the audit must link to the evidence log");

console.log("audit-report-consistency=pass");
