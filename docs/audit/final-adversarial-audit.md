# Current-Tree Extension Audit Snapshot

| Field | Value |
|---|---|
| Evaluation date | September 23, 2026 |
| Extension version | 1.1.1 |
| Build entry points | 8 |
| Scope | Current extension source, content-script flow, measurement, and release packaging |
**Status:** Evidence-scoped verification; this is not a whole-product production certification.

This snapshot replaces the September 13 audit. Its prior `1.1.2` version, seven-bundle count, blanket “production-ready” verdict, browser-success assertion, backend test count, and optimizer-preview claims did not match the current source or verification evidence.

## Verified in this snapshot

| Area | Evidence | Result |
|---|---|---|
| TypeScript and extension build | `node node_modules/typescript/bin/tsc --noEmit --pretty false`; `node scripts/build.mjs` | Pass; eight build entry points |
| Live observation and state | `verify-live-capture.mjs`, `verify-capture-state.mjs`, `verify-submission-flow.mjs` | Pass; sender/site validation, timeout, completion, and submit de-duplication covered |
| Token measurements | `verify-tokenizer-wiring.mjs`, `verify-context-unknown.mjs`, `benchmark-accuracy.mjs` | Pass; model-aware OpenAI BPE and truthful unknown/approximation paths |
| Overlay and copy action | `verify-overlay-window.mjs`, `verify-copy-shorter.mjs`; `verify-overlay-browser.cjs` in Microsoft Edge | Pass in a controlled Claude-shaped fixture; layout, input updates, copy result, unchanged composer, and no-candidate feedback checked |
| Package integrity | `verify-package-preflight.mjs`; `verify-extension.ps1` | Pass; manifest entries, wildcard resources, traversal, archive contents, output preservation, and reproducible SHA-256 checked |

The current 20-sample heuristic benchmark reports 17.97% mean absolute percentage error and 37.61% maximum absolute percentage error against the pinned OpenAI `o200k_base` reference. This is not provider billing truth. The deterministic tokenizer counts visible text only; hidden system prompts, tools, images, and provider serialization are not observable here.

The “Copy shorter” actions create a formatting-only candidate by normalizing line endings and collapsing excess blank lines outside code. They preserve the source prompt and code blocks. The product does not provide side-by-side shorter, balanced, and max-detail previews.

## Not verified

- The browser check used Microsoft Edge with a controlled provider-shaped page, not a signed-in provider account. Live provider selectors, quotas, and billing counters remain unverified.
- The Playwright-bundled Chromium executable was absent. Installed Chrome did not load the extension in this runner; the Edge run did.
- The browser capture suite and the backend's PostgreSQL/Redis integration suite were not established as passing in this snapshot.
- The old F-01 through F-14 checklist was not independently reproduced as a current, complete baseline.

The release verifier passed with a temporary `npm` shim because this runner has Node and installed dependencies but no `npm` executable. The shim mapped `npm run typecheck` and `npm run build` to the same checked-in Node commands; the verifier then completed its regression and reproducible-package checks.

See [the ten-cycle remediation report](./ten-cycle-remediation-report.md) for cycle-by-cycle findings, prompts, fixes, and command evidence. Re-run this snapshot's checks after source, manifest, build, or release-process changes.
