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

The follow-up red test failed because the worker had no tab-close listener (`the worker must register tab-close cleanup`). After the fix, `node scripts/build.mjs` and `node scripts/verify-live-capture.mjs` both passed; the regression prints `live-capture-regressions=pass`.

### Strong audit

The focused regression now exercises the real bundled service worker with mocked Chrome storage/runtime boundaries. It proves the observation reaches the right sender tab; provider identity comes from the sender URL; missing/mismatched senders and oversized drafts are rejected; close cleanup removes only the closed tab; and the second tab remains readable. The tab-view result has no `usageEvents` property. Build and focused verification pass. Full TypeScript checking and browser execution remain unverified because the compiler stalled without output and Playwright launch returns `spawn UNKNOWN` on this host.

---

## Cycle 2 — one live session per tab

### Finding

`SessionManager` stored both `tabId:site` and a tab-only alias. Navigating a tab to another provider left its previous provider session behind, and `getAllSessions()` surfaced both entries.

### Red test

The focused regression first failed with `a tab navigation must replace its old provider session` (`2 !== 1`).

### Implementation

Changed the manager to one session per numeric tab id. A session records its current provider; provider-filtered reads reject stale providers, and tab-close cleanup removes the one entry.

### Strict audit

After a fresh build, the navigation and close-isolation cases passed. Strict boundary review found that `Number.isInteger(-1)` is true and `SessionManager.setSession` had no runtime id validation. A malformed negative Chrome-tab id could therefore create a live session under an invalid key.

### Fix prompt

See the cycle-2 section in `docs/audit/ten-cycle-remediation-fix-prompt.md`. It asks for negative, non-safe-integer, and missing-tab cases to be rejected without mutating current sessions.

### Follow-up implementation

Added non-negative safe-integer validation at both the sender boundary and `SessionManager.setSession`. The new red case failed because a negative sender tab id was accepted (`true !== false`). Direct manager tests also reject `-1`, `NaN`, fractional ids, and values above `Number.MAX_SAFE_INTEGER`; rejected ids leave the collection unchanged.

### Strong audit

Fresh build plus `node scripts/verify-live-capture.mjs` pass. The regression covers same-tab provider navigation, per-tab lookup, newest-first ordering, close cleanup, unrelated-tab preservation, missing and mismatched senders, over-limit drafts, and invalid ids. Each rejection leaves valid session state intact. `git diff --check` passes. The manager now stores one object per tab and never retains the previous provider draft after navigation.

---

## Cycle 3 — keyboard and form submission

### Finding

The content script listened only for clicks on the send button. Ordinary Enter and native form submits could bypass the capture state machine.

### Red test

`node scripts/verify-submission-flow.mjs` failed because `src/capture/submissionListeners.ts` did not exist. The regression specifies Enter, Shift+Enter, IME composition, native submit, click, duplicate signals, and no interference with native submission.

### Implementation

Added a shared submit-signal observer and wired it into the content script. It captures ordinary Enter in the active composer, native form submits containing the composer, and send-button clicks. It ignores Shift+Enter, IME composition/keyCode 229, unrelated targets, and empty drafts. It does not call `preventDefault`.

### Strict audit

The event regression passes all initial cases. Review found the 600 ms duplicate window also suppresses a legitimate repeat of the same prompt if the user clears and retypes it inside that interval. A prompt change should reset deduplication immediately.

### Fix prompt

See the cycle-3 section in `docs/audit/ten-cycle-remediation-fix-prompt.md`. It adds a same-text repeat after clear/retype and verifies that only repeated signals without intervening edits are deduplicated.

### Follow-up implementation

The event helper now resets its duplicate signature on composer input changes. The follow-up test first failed because clear/retype still counted as a duplicate (`1 !== 2`); after the fix it captures the identical repeated prompt as a new send while duplicate Enter/form/click signals remain one capture.

### Strong audit

`node scripts/verify-submission-flow.mjs` passes with four intended submissions, duplicate signals deduplicated, and zero `preventDefault` calls. A fresh build and `node scripts/verify-live-capture.mjs` pass. Code review confirms listeners filter to the active composer/form/send control, ignore Shift+Enter and IME composition, and call the same state machine used by click capture. The browser-based extension check remains blocked by runner `spawn UNKNOWN`; the event helper itself is exercised in a focused Node harness.

---

## Cycle 4 — stable response completion

### Finding

When a provider exposes no stop control, the first non-empty assistant DOM update immediately committed the response. A rendered partial could therefore become a durable usage event.

### Red test

`node scripts/verify-capture-state.mjs` initially failed with `a response without a stop control must not commit immediately` (`1 !== 0`).

### Implementation

Added a one-second quiet period, restarted on changed assistant text. The callback confirms that the same new assistant message still exists, polls while a stop control remains, then commits once stable. Navigation, rate-limit, cancel, completion, and existing timeout paths clear the completion timer.

### Strict audit

The quiet, continued-stream, stop-control, and single-commit checks pass. Review found the ten-minute abandonment guard still runs only inside `onDomUpdate`; if an empty or silent response produces no further DOM mutations, the pending exchange never expires.

### Fix prompt

See the cycle-4 section in `docs/audit/ten-cycle-remediation-fix-prompt.md`. It adds a no-mutation deadline test and requires a real timer that discards stale pending work without committing partial text.

### Follow-up implementation

Added a per-exchange ten-minute timer scheduled at submit time and cleared on completion, rate-limit, cancel, navigation, replacement, or abandonment. The new red test submitted without any DOM update and advanced past the deadline; it failed because the pending draft remained. After the fix the state becomes `ABANDONED`, the pending exchange is cleared, no event is committed, and all timers are released.

### Strong audit

`node scripts/verify-capture-state.mjs` passes for a no-stop stable response, a response that keeps growing, a stop control that remains visible, a silent request crossing the deadline, single-commit behavior, and timer cleanup. The focused live-capture tests and fresh build also pass. The completion callback re-reads the latest assistant message and checks its id/text before committing, so a stale timer cannot finalize a replaced DOM node.

---

## Cycle 5 — content-script privacy boundary

### Finding

Provider-page content scripts requested `get-snapshot`, which returned the whole extension state. A `commit-usage-event` response also returned a snapshot even though the content caller ignored it.

### Red test

The updated worker regression failed with `get-snapshot must be denied to a provider-page sender`; the actual result contained the full state and had no denial acknowledgement.

### Implementation

Moved content initialization to `get-tab-view-state`, protected full snapshot/state/export reads with the internal-extension sender check, and changed event commits to return only `{ ok, eventId, recorded }`.

### Strict audit

The first live-capture harness passed the narrow tab view, denied page-origin `get-snapshot`, `get-state`, and `export-data`, kept extension-owned snapshots available, and confirmed event commits returned no state/snapshot. The strict follow-up harness then failed on a cross-provider commit (`true !== false`), and after that guard was added it failed on `save-preferences` (no denial acknowledgement). A sender-by-sender review also found that `import-data`, legacy `capture-session`, `clear-local-history`, cloud controls, `notify`, and `toggle-overlay` needed extension-page authorization. The content script ignored the returned site/global overlay settings. A further review found the denial helper's cloud-specific error was misleading for non-cloud endpoints; the new regression failed on that response text.

### Fix prompt

See the cycle-5 section in `docs/audit/ten-cycle-remediation-fix-prompt.md`. It exercises every privileged message path, verifies denied actions have no side effects, rejects provider/site mismatches and unsupported tabs, and checks overlay preference handling.

### Follow-up implementation

Added the content sender/site check before recording an event; non-tab event commits now require an extension-page sender. Added extension-page guards to preference/import/session/history/cloud/notification/overlay worker actions. The test proves denied calls do not alter preference/history state, message another tab, or create a notification; an extension-owned settings sender can still save preferences. Generalized the denial message to cover all extension-page-only actions. Added `isOverlayInitiallyVisible` and applied it to the mounted container using `siteEnabled` and global `showOverlay`; unavailable settings preserve the existing visible default. `TabViewStateResponse` now models success and failure separately, and content callers type both view and commit acknowledgements.

The strict red cases were reproducible: the mismatched event was accepted before the sender/site check, `save-preferences` returned no denial acknowledgement before authorization, the overlay regression failed because the helper module did not exist, and the denied-action message falsely referred only to cloud settings. After the fixes, a fresh `node scripts/build.mjs` and these focused commands pass:

- `node scripts/verify-live-capture.mjs` — `live-capture-regressions=pass`.
- `node scripts/verify-tab-view-preferences.mjs` — `tab-view-preferences-check=pass`.
- `node scripts/verify-submission-flow.mjs` — four intended submissions, duplicate signals deduplicated, native behavior preserved.
- `node scripts/verify-capture-state.mjs` — quiet completion, stream reset, stop control, hard timeout, timer cleanup.
- `git diff --check` — pass.

### Strong audit

Reviewed every service-worker message case: global read/write/export/history/cloud and notification/overlay actions require an extension URL; content observations and event commits derive the provider from the tab URL; a commit's event site must match that provider. Rejected events are proven absent from history, rejected writes leave preferences/history unchanged, and denied overlay/notification actions cause no tab message or notification. The narrow tab-view response exposes only the selected site's preference and matching live session; event acknowledgements contain no snapshot/state. Extension-owned `get-state`/`get-snapshot` and preference saving remain available in the harness. Denial responses identify the extension-page boundary. The overlay helper covers site-disabled, global-overlay-disabled, enabled, and unavailable-response cases, and source integration applies `display:none` before the browser paints. All focused regressions and build pass. Full browser execution remains unverified because the runner reports Windows `spawn UNKNOWN` when launching Chromium.

---

## Cycle 6 — model-aware tokenizer wiring

### Finding

The estimator could label a count `deterministic_local` even when no encoder was available. Its runtime encoder loading also crossed from the isolated content-script world into the page world, active draft/capture calls omitted model tokenizer options, and the single default encoder was incorrectly used for both `o200k_base` and `cl100k_base`.

### Red test

`node scripts/verify-tokenizer-wiring.mjs` initially failed because a GPT-4o estimate without an encoder reported `deterministic_local` instead of `approximation`.

### Implementation

Added an encoder-availability check so the fallback path no longer claims deterministic measurement when no encoder function is present.

### Strict audit

After the availability guard, the focused check advanced to `cl100k_base` and failed with `22 !== 24`: the local `gpt-tokenizer` root export is `o200k_base`, while the count path reused that function for cl100k requests. Source review found the content script only injects `content/gpt-tokenizer.js` through a page `<script>` (main-world code), while the estimator runs in the isolated extension world; the manifest lists the tokenizer as a web-accessible resource but not as a content script. Further, `getDraftTokenBreakdown` and the capture state machine call the estimator without provider/model/tokenizer options, so recognized GPT models never request their known tokenizer. Unknown OpenAI models and non-OpenAI providers need to remain approximate. Bundle inspection measured the two-encoding output at 5.3 MB, so loading it on Claude, Gemini, Perplexity, or Grok pages would impose needless parsing cost. A state-machine regression then failed with `deterministic_local` after a mocked encoder threw: the numeric path fell back to a heuristic, but the event rebuilt its metadata from encoder presence rather than the result. The live context-accounting path had the same issue. A wording assertion failed because metadata called the third-party package an “official BPE encoder” and did not say hidden provider context was excluded. Attachment audit found unknown binary token contribution was converted from `null` to zero; the new regression failed with `22 !== null`. A page-count attachment estimate likewise cannot make the overall total deterministic. Tracing that `null` to content also showed JavaScript addition silently drops the unknown state (`visibleTokens + null`), and the overlay hardcodes context pressure to `low` even when the total is incomplete or the real provider context is hidden.

### Fix prompt

See the cycle-6 section in `docs/audit/ten-cycle-remediation-fix-prompt.md`. It requires separate o200k/cl100k encoders in the isolated content-script world, explicit model-profile resolution on draft and committed prompt/response paths, truthful approximation fallback when an encoder is absent or throws, and regressions for supported, missing, unknown, and non-OpenAI tokenizer cases.

### Follow-up implementation

Moved the two OpenAI encoders into a `document_start` isolated content script scoped to ChatGPT hosts, then resolve model profiles on both draft and committed exchange paths. Fallback metadata now reflects the actual result, including encoder exceptions; unknown attachment totals remain `null`, and estimated attachments downgrade the combined total to approximation. Context accounting reuses the draft measurement, displays “Unknown” for incomplete totals, and keeps pressure unknown because provider-owned context is hidden. Added a focused context helper and regression; widened the context total type to `number | null`. The full typecheck also exposed and fixed pre-existing inferred-type failures in the storage helpers. Cleaned up indentation found during source review.

### Strong audit

The strict follow-up regressions now pass for both installed encodings against the package's actual `o200k_base` and `cl100k_base` output; supported GPT-4o draft/prompt/response paths; unknown models and non-OpenAI providers; absent or throwing encoders; unknown and rough attachment contributions; manifest world, load order, and host scope; and incomplete context totals. `node scripts/verify-context-unknown.mjs`, `node scripts/verify-tokenizer-wiring.mjs`, `node scripts/verify-capture-state.mjs`, `node scripts/verify-live-capture.mjs`, `node scripts/verify-submission-flow.mjs`, `node node_modules/typescript/bin/tsc --noEmit --pretty false`, `node scripts/build.mjs`, and `git diff --check` pass. The 20-sample OpenAI BPE benchmark reports mean absolute percentage error 17.97% and maximum 37.61%; this measures the heuristic benchmark corpus, not provider billing truth. Browser execution is still unverified because the prior Chromium runner failed with Windows `spawn UNKNOWN`.

---

## Cycle 7 — copy-shorter controls

### Finding

The page overlay exposed a `Copy shorter` button without a click action. The popup's similarly named button copied `currentDraft` verbatim, and the optimizer module was not connected to either control.

### Red test

`node scripts/verify-copy-shorter.mjs` first failed because `getCopyShorterCandidate` did not exist. After the first-pass wiring, it produced a shorter string but failed the fenced-code preservation assertion: the selected optimizer candidate collapsed code indentation and removed an identical repeated code line.

### Implementation

Added a helper that chooses the shortest generated suggestion and wired it into both the page overlay and popup. The overlay copies from the current composer and leaves the composer untouched; the popup now copies a generated candidate instead of the unchanged draft.

### Strict audit

The helper's initial “shortest suggestion” policy treated every optimizer suggestion as suitable for a one-click copy. It could mutate fenced code (indentation and repeated source lines), strip trailing spaces that encode Markdown hard line breaks, and copy speculative phrase rewrites such as “for the purpose of” → “for” without showing a preview. `deduplicateLines` also scanned through code fences. Both UIs relied solely on `navigator.clipboard.writeText`; the overlay reported failure but had no fallback for content-script clipboard restrictions.

### Fix prompt

See the cycle-7 section in `docs/audit/ten-cycle-remediation-fix-prompt.md`. Limit one-click candidates to formatting changes that preserve code blocks and Markdown hard breaks; do not select speculative wording or duplicate-removal rewrites. Keep standalone optimizer suggestions from editing code blocks and mark meaning-changing suggestions as non-preserving. Add a shared clipboard helper with a tested fallback, keep the source composer unchanged, and show useful copied/no-candidate/error feedback in both controls.

### Follow-up implementation

Restricted the copy candidate to line-ending normalization and excess blank-line cleanup; it no longer chooses deduplication or wording suggestions. Cleanup now preserves fenced code, blockquoted fenced code, and indented Markdown code, including duplicate source lines, indentation, blank lines, and line endings. Standalone deduplication and wording suggestions skip those code forms and no longer claim semantic preservation. Added a shared clipboard writer with `navigator.clipboard.writeText` plus a synchronous `execCommand` fallback. Both controls use it, leave the prompt unchanged, and report copied, no-candidate, and copy-failure states distinctly. Added a `YOR_CHROME_PATH` override to the browser harness so the installed Edge browser can run the extension test when Playwright's bundled Chromium is absent.

### Strong audit

`node scripts/verify-copy-shorter.mjs` passes checks for shorter candidate generation, fenced/blockquote/indented code preservation, CRLF preservation, Markdown hard-break spaces, no speculative wording changes, reviewed semantic suggestions, composer immutability, Clipboard API success, fallback success, and truthful failure. The first strong-audit expansion failed on four-space indented code and then on blockquoted fenced code; the parser was extended for both and the focused check passed afterward. `node scripts/verify-overlay-browser.cjs` passes in installed Microsoft Edge with the real unpacked extension and a controlled Claude-shaped fixture: the page-meter/card layout stays in bounds, the button copies the shortened text, the composer remains unchanged, and the no-candidate message appears. `node node_modules/typescript/bin/tsc --noEmit --pretty false`, `node scripts/build.mjs`, capture-state, live-capture, submission-flow, overlay-window, and `git diff --check` pass. The bundled Playwright Chromium executable is absent and installed Chrome did not load the extension in this runner; the Edge run supplied the browser-level verification.

---

## Cycles 8–10

Pending execution. Each entry will include the reproducible finding, red test or audit evidence, implementation, strict review, specific follow-up prompt, second-pass fix, and strong post-fix review.
