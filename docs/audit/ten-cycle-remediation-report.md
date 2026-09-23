# Yor Token Usage: Ten-Cycle Remediation Report

**Started:** 2026-09-23  
**Branch:** `codex/yor-token-usage-remediation`  
**Baseline:** `b6c4e83bc4c72b64f4af2296c2f5731eaf1690c6` (`main`)  
**Status:** In progress. A cycle is complete only after its strict audit, follow-up fix prompt, implementation, and strong audit are all recorded with command evidence.

## Baseline audit

The extension's source checkout is not directly loadable: generated JavaScript bundle paths in `manifest.json` are ignored and absent until `npm run build`. More seriously, the content script sends `submit-tab-observation`, but the service worker has no case for it and returns `Unknown message type`. The content script requests global snapshots for page preferences, while storage snapshots include global state. Enter/form submission is not observed, response completion can be immediate when no stop control exists, the deterministic tokenizer is injected into the page's JavaScript world while the isolated content script reads its own global, and “Copy shorter” has no handler. The existing final audit describes a different version and asserts behavior the current source does not implement.

## Baseline verification evidence

- `node scripts/build.mjs` — PASS, eight bundles.
- `node scripts/check-design.mjs` — PASS after build.
- `node scripts/benchmark-accuracy.mjs` — PASS, 20 samples; max absolute percent error 37.61% against the OpenAI BPE reference corpus. This is not provider billing ground truth.
- `node scripts/verify-quota-evidence.mjs` — PASS.
- `node scripts/verify-overlay-window.mjs` — PASS.
- `node scripts/verify-reset-predictor.mjs` — PASS.
- `node scripts/verify-adversarial-stress.mjs` — PASS, 10,026 assertions; emits thousands of individual PASS lines.
- `node scripts/verify-extension-runtime.mjs` — PASS after build.
- `node node_modules/typescript/bin/tsc --noEmit` — no output and remained idle for more than 90 seconds; interrupted. No typecheck result established.
- `node scripts/verify-capture-browser.cjs` and `node scripts/verify-overlay-browser.cjs` — both fail at Playwright launch with `spawn UNKNOWN` on this Windows runner after installing Chromium 1234. Browser behavior is unverified locally.

## Cycle 1 — live observation protocol

### Finding

The content script emits `submit-tab-observation`; the service worker had no handler. The protocol also declared `get-tab-view-state` without implementing it.

### Red test

`node scripts/verify-live-capture.mjs` failed with `submit-tab-observation must be handled (received Unknown message type)`.

### Implementation

Added sender-derived tab/provider validation, bounded live draft storage in `SessionManager`, and a typed tab-view response containing only the current tab session and current-site preferences.

### Strict audit

Fresh `node scripts/build.mjs` followed by `node scripts/verify-live-capture.mjs` passed. Manual path review confirmed the tab id comes from `sender.tab.id`, the provider from Chrome's sender URL, the draft limit is enforced, and the live observation is not written to persistent storage. The audit found a follow-up gap: no `chrome.tabs.onRemoved` listener reclaims a session when a tab closes.

### Fix prompt

See `docs/audit/ten-cycle-remediation-fix-prompt.md`. The cycle-1 follow-up requires a red regression proving tab removal releases only that tab's live state and malformed senders cannot mutate it.

### Follow-up implementation

Added a `chrome.tabs.onRemoved` listener that calls `SessionManager.removeTab`. Expanded the regression to open a second same-provider tab, remove the first, and assert the second draft remains intact. Added rejects for missing-tab senders, sender/provider mismatch, and a draft exceeding the 250,000-character live limit; each rejected message must leave the valid session unchanged.

The follow-up red test failed because the worker had no tab-close listener (`the worker must register tab-close cleanup`). After the fix, `node scripts/build.mjs` and `node scripts/verify-live-capture.mjs` both passed; the regression prints `live-capture-cycle-1=pass`.

### Strong audit

The focused regression now exercises the real bundled service worker with mocked Chrome storage/runtime boundaries. It proves the observation reaches the right sender tab; provider identity comes from the sender URL; missing/mismatched senders and oversized drafts are rejected; close cleanup removes only the closed tab; and the second tab remains readable. The tab-view result has no `usageEvents` property. Build and focused verification pass. Full TypeScript checking and browser execution remain unverified because the compiler stalled without output and Playwright launch returns `spawn UNKNOWN` on this host.

---

## Cycles 2–10

Pending execution. Each entry will include the reproducible finding, red test or audit evidence, implementation, strict review, specific follow-up prompt, second-pass fix, and strong post-fix review.
