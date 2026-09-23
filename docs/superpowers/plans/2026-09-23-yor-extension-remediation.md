# Yor Token Usage Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete ten evidence-backed remediation cycles that make the extension's local capture and release path work reliably and truthfully.

**Architecture:** Keep the existing MV3/TypeScript design. Route content observations through typed, sender-derived tab messages into ephemeral per-tab sessions; use a single submission path and stable completion rules; minimize content-visible state; then repair measurement, optimizer, packaging, documentation, and regression gates.

**Tech Stack:** TypeScript, Chrome Manifest V3 APIs, esbuild, Playwright, Node.js verification scripts.

**Spec:** `docs/superpowers/specs/2026-09-23-yor-extension-remediation-design.md`

## Global Constraints

- Keep live prompt and response text out of durable storage and cloud payloads.
- Derive tab ids from `MessageSender.tab.id`, never from untrusted content payloads.
- Preserve Manifest V3 and the repository's current dependency versions.
- Do not describe heuristic counts as exact or as provider billing truth.
- Keep generated bundles ignored; build before packaging or browser-loading.
- Record exact commands, outputs, and runner limitations in the audit report.

## Review Focus

- Missing or non-tab sender: observation is rejected without creating a session.
- Same provider in two tabs and tab removal: session state remains isolated and is reclaimed.
- Enter, Shift+Enter, IME composition, form submit, and click arriving together: only intended submissions are captured once.
- No stop control, delayed response, changing stream, empty response, and timeout: incomplete output is never committed early.
- Recognized OpenAI model, unknown model, non-OpenAI provider, and tokenizer unavailable: measurement provenance matches the actual path.

---

### Task 1: Wire the live message contracts

**Files:**
- Modify: `src/types/messages.ts`
- Modify: `src/background/service-worker.ts`
- Create: `scripts/verify-live-capture.mjs`

**Interfaces:** Consume the existing `ContentToBackgroundMessage` union. Produce acknowledgement-only handling for `submit-tab-observation`; derive `tabId` from `sender.tab.id`; return a narrow tab-view response for `get-tab-view-state`.

- [x] Add a regression case that sends `submit-tab-observation` from a tab sender and asserts that it is acknowledged and retrievable for that sender tab.
- [x] Run `node scripts/verify-live-capture.mjs`; expected baseline: it fails because the service worker returns `Unknown message type`.
- [x] Add the service-worker cases with sender validation and a tab-session update.
- [x] Rebuild and run the focused regression; expected: observation is stored and returned to the same tab only.
- [x] Strict-audit sender identity, message size, and response shape; record cycle 1 in `docs/audit/ten-cycle-remediation-report.md`.

### Task 2: Isolate and reclaim tab sessions

**Files:**
- Modify: `src/background/sessionManager.ts`
- Modify: `src/background/service-worker.ts`
- Create or extend: `scripts/verify-live-capture.mjs`

**Interfaces:** Consume the `LiveTabSession` stored by Task 1. `SessionManager.setSession`, `getSession`, `getAllSessions`, and `removeTab` remain the public API.

- [ ] Add behavior checks for two ChatGPT tabs, latest-session ordering, and removal of a closed tab.
- [ ] Run the focused regression; expected baseline: a tab-only alias can point at another provider session and the worker does not remove tab state.
- [ ] Keep one authoritative compound-key entry per session and wire `chrome.tabs.onRemoved` to `removeTab`.
- [ ] Rebuild and rerun the focused regression; expected: both tabs remain independent and removed tab state disappears.
- [ ] Strict-audit key matching and cleanup; record cycle 2.

### Task 3: Capture Enter and form submissions once

**Files:**
- Modify: `src/content/index.ts`
- Modify: `src/capture/stateMachine.ts`
- Create: `src/capture/submissionListeners.ts`
- Create or extend: `scripts/verify-live-capture.mjs`

**Interfaces:** Produce one listener helper that calls the existing `CaptureStateMachine.onUserSubmit(text, model, threadId, visibleMessages)` callback for valid submissions.

- [ ] Add event cases for Enter, Shift+Enter, IME composition, native form submit, click, and click-plus-submit duplication.
- [ ] Run the regression; expected baseline: keyboard/form events are missed and duplicate signals can replace pending state.
- [ ] Route all signals through one idempotent submit helper; leave browser-native submission behavior intact.
- [ ] Rebuild and rerun; expected: intended sends are captured exactly once, while Shift+Enter and IME composition are ignored.
- [ ] Strict-audit key modifiers, nested send-button targets, and repeated events; record cycle 3.

### Task 4: Wait for stable response completion

**Files:**
- Modify: `src/capture/stateMachine.ts`
- Create or extend: `scripts/verify-live-capture.mjs`
- Modify if required: `scripts/verify-capture-browser.cjs`

**Interfaces:** Keep `CaptureStateMachine.onDomUpdate` and `onUserCancel`; add an injectable or exported completion timing constant only if needed for deterministic tests.

- [ ] Add tests for text that continues growing, text that goes quiet without a stop control, explicit stop-control removal, and stale empty response.
- [ ] Run the regression; expected baseline: non-empty text commits immediately when no stop control exists.
- [ ] Track text changes rather than every DOM poll; commit after stable quiet time and abandon the existing hard timeout without writing partial output.
- [ ] Rebuild and rerun focused capture checks; expected: growing text remains pending and stable output is committed once.
- [ ] Strict-audit delayed updates, navigation, cancel, and duplicate mutation notifications; record cycle 4.

### Task 5: Minimize content-script state

**Files:**
- Modify: `src/content/index.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `src/types/messages.ts`
- Create or extend: `scripts/verify-live-capture.mjs`

**Interfaces:** Content initialization consumes `TabViewStateResponse`; content event commits receive only `{ ok, eventId? }`; extension UI retains its existing snapshot interface.

- [ ] Assert provider-page requests receive only site preferences, a matching tab session, and minimal acknowledgements.
- [ ] Run the regression; expected baseline: initialization/commit responses expose global state or cannot use the tab view.
- [ ] Move content initialization to `get-tab-view-state` and stop returning `buildSnapshot` from content-originated actions.
- [ ] Rebuild and rerun; expected: no cross-provider events, threads, or global settings are present in page-facing responses.
- [ ] Strict-audit all worker message cases by sender type; record cycle 5.

### Task 6: Make tokenization match the selected model

**Files:**
- Modify: `manifest.json`
- Modify: `src/measurement/tokenizer.ts`
- Modify: `src/measurement/accuracy-engine.ts`
- Modify: `src/content/index.ts`
- Modify: `src/capture/stateMachine.ts`
- Create or extend: `scripts/verify-live-capture.mjs`

**Interfaces:** Resolve model metadata through `resolveModelProfile`; estimate functions receive an explicit tokenizer only for supported models. The tokenizer bundle runs in the content-script isolated world.

- [ ] Add tests for a supported OpenAI model with a loaded encoder, the same model without an encoder, an unknown OpenAI model, and non-OpenAI providers.
- [ ] Run the regression; expected baseline: active calls omit tokenizer options, global injection is inaccessible, and deterministic metadata can be returned without deterministic counts.
- [ ] Load the encoder in the content-script world, route only supported models, and report deterministic provenance only after successful encoding.
- [ ] Rebuild and rerun; expected: matching BPE is deterministic and every unsupported/unavailable path remains approximate.
- [ ] Strict-audit bundle order/size, unknown labels, attachments, and confidence claims; record cycle 6.

### Task 7: Make “Copy shorter” real and non-destructive

**Files:**
- Modify: `src/content/index.ts`
- Modify: `src/optimizer/safeOptimizer.ts`
- Create or extend: `scripts/verify-live-capture.mjs`

**Interfaces:** The button reads the current composer value, obtains a safe suggestion, copies only after user click, and never writes to the composer.

- [ ] Test a prompt with a safe shorter version, a prompt with no safe version, code/indent-sensitive text, and clipboard rejection.
- [ ] Run the regression; expected baseline: the button has no behavior and the whitespace helper may alter meaningful spacing.
- [ ] Implement conservative safe shortening, clipboard result feedback, and an explicit no-safe-result message.
- [ ] Rebuild and rerun; expected: clipboard receives only approved safe output, composer value remains unchanged, and failure is visible.
- [ ] Strict-audit semantic preservation and clipboard permission behavior; record cycle 7.

### Task 8: Validate clean-checkout packaging

**Files:**
- Modify: `scripts/verify-extension-runtime.mjs`
- Modify: `scripts/package-extension.ps1`
- Modify: `README.md`
- Create or extend: `scripts/verify-live-capture.mjs`

**Interfaces:** Package validation reads the manifest, resolves local resource references against the extension root, and fails before ZIP creation on a missing resource.

- [ ] Add a temporary-fixture test with a missing manifest resource and an intact built extension.
- [ ] Run the check against source before build; expected baseline: there is no explicit missing-resource error, and a direct checkout cannot load.
- [ ] Validate every manifest script/page/icon/worker resource before package creation and document `npm ci`, build, verification, and zip steps.
- [ ] Run build, resource validation, and package generation; expected: all manifest references exist and the archive is created reproducibly.
- [ ] Strict-audit output archive contents and clean-checkout instructions; record cycle 8.

### Task 9: Replace stale audit claims

**Files:**
- Replace: `docs/audit/final-adversarial-audit.md`
- Create: `docs/audit/ten-cycle-remediation-report.md`
- Create: `docs/audit/ten-cycle-remediation-fix-prompt.md`

**Interfaces:** The report records baseline, ten cycle entries, commands and outcomes, post-fix evidence, and unverified limitations. The reusable prompt specifies the cycle protocol without asserting success in advance.

- [ ] Cross-check every version, test command, claim, and changed behavior against source and fresh command output.
- [ ] Rewrite the stale “production-ready” audit and include all ten strict/strong audit records.
- [ ] Strict-audit every report statement for evidence and separate baseline facts from post-fix facts; record cycle 9.

### Task 10: Add the final regression gate and concise stress output

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/verify.yml`
- Modify: `scripts/verify-adversarial-stress.mjs`
- Modify: `scripts/verify-live-capture.mjs`

**Interfaces:** A single package script runs the focused regression suite after build; CI invokes it; stress checks summarize aggregate counts instead of logging each malformed event.

- [ ] Add a check that proves the new regression command catches the original protocol, submit, completion, privacy, tokenization, optimizer, and packaging failures.
- [ ] Run the command before wiring it to CI; expected baseline: the relevant behaviors fail.
- [ ] Add a concise run summary and CI step; keep individual failure details available.
- [ ] Run the complete extension verification sequence; expected: all runnable local checks pass, with browser-launch limitation reported separately if it persists.
- [ ] Strict-audit final diff and report; record cycle 10 and produce the final strong-audit finding list.

## Completion gate

- [ ] Ten report entries each contain finding, fix prompt, implementation, strict audit, and strong audit.
- [ ] Run a fresh build, typecheck, focused regression, design/accuracy/quota/overlay/reset/stress checks, browser checks if the runner permits, package validation, and `git diff --check`.
- [ ] Resolve all Critical/Important findings from the final review; document lower-priority findings.
- [ ] Commit and push the completed branch to `origin`.
