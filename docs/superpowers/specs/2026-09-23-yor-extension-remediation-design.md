# Yor Token Usage Remediation Design

## Goal

Make the extension's core local workflow work from a clean checkout: observe drafts, detect submitted prompts, wait for completed responses, record usage, and show only the state each UI surface needs. Keep measurements and release instructions honest about their limits.

## Evidence and scope

The baseline audit found that the content script sends `submit-tab-observation`, while the service worker has no handler for it; keyboard and form submissions are not observed; sessions are not wired to the service worker; response completion is inferred immediately when a stop control is absent; provider-page content scripts request full global state; and the tokenizer loader injects into a different JavaScript world from the content script that reads the global. The visible “Copy shorter” control has no action. A clean checkout also lacks the generated JavaScript files referenced by `manifest.json` until a build runs. The existing final audit claims conflict with source and current version information.

## Design decisions

1. Keep the current Manifest V3, TypeScript, esbuild, storage, and provider adapter architecture.
2. Treat tab identity as background-owned data from `sender.tab.id`; never accept a tab id supplied by page content.
3. Keep live session state ephemeral in the service worker, keyed by tab and provider, and clear it when a tab closes.
4. Support click, ordinary Enter, and native form-submit signals through one idempotent capture path; preserve Shift+Enter and IME composition.
5. Complete a response only after explicit generation-stop evidence or a bounded quiet period after the response text stops changing. A timeout must discard incomplete work rather than silently commit partial output.
6. Give provider content scripts a narrow tab-view response and an acknowledgement for event commits. Keep full snapshots inside extension-owned UI contexts.
7. Run the tokenizer in the content script's isolated extension world. Claim deterministic counts only when the selected tokenizer is loaded and actually used; keep all other counts labeled estimates.
8. Make the shorter-copy action non-destructive and report when no safe shortening is available.
9. Keep generated bundles out of source control, but make build, manifest validation, package generation, and clean-checkout instructions explicit and repeatable.
10. Replace stale production claims with evidence-backed audit documentation and run focused regression checks in CI.

## Ten remediation cycles

1. Handle the existing live observation and tab-view message contracts.
2. Enforce per-tab session isolation and reclaim state when tabs close.
3. Capture keyboard and native form submission without duplicate events.
4. Use stable streaming completion and bounded abandonment behavior.
5. Narrow provider content-script state and message responses.
6. Route known models through the correct available tokenizer and truthful fallback.
7. Connect “Copy shorter” to safe, user-triggered behavior.
8. Validate every manifest resource and document the clean-checkout packaging path.
9. Replace the contradictory final audit with a verified baseline and post-fix status.
10. Add a focused CI regression gate and remove stress-suite per-record log spam.

## Acceptance criteria

- Every cycle has a reproducible finding, a concrete fix prompt, an implementation record, and a strong post-fix audit result.
- Tests for behavioral changes are observed failing before implementation and passing after implementation.
- Two tabs for the same provider never share live state, and closed tabs leave no live session behind.
- Enter/form submit is captured once; Shift+Enter and IME composition do not submit.
- A growing response is not committed early; a quiet completed response is eventually committed once; stale pending work is abandoned.
- Content messages cannot receive cross-provider event history or settings.
- Unknown/unavailable tokenizers remain estimates; deterministic provenance appears only for measured text with the matching loaded tokenizer.
- Copy-shorter never changes the provider composer and communicates success/failure.
- A build followed by package validation produces an archive whose manifest references all exist.
- The report distinguishes product failures from local browser-launch limitations and does not claim unrun checks passed.
- Changes are committed on a `codex/` branch and pushed to the configured `origin` remote.

## Verification constraints

Run focused Node regression scripts, TypeScript compilation, esbuild, manifest/package checks, and the existing quality scripts. Attempt the Playwright browser checks after installing the pinned browser. If this Windows runner cannot launch Chromium, record the exact launch failure and rely only on checks that actually ran. Do not upgrade dependencies or alter the remote main branch.
