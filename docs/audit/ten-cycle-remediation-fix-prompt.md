# Reusable Prompt: Audit, Fix, and Re-Audit

Use this prompt with the current source tree and the latest entry in `docs/audit/ten-cycle-remediation-report.md`:

> Continue the requested remediation cycle from the current repository state. First reproduce the recorded failure or verify the exact code path. Write a focused test for the user-visible behavior and run it before changing production code; preserve the expected failing output. Implement the smallest complete fix that resolves the root cause. Then perform a strict audit of the changed path, its callers, data boundaries, error cases, lifecycle, and neighboring behavior. Record the audit findings and a concrete follow-up fix prompt in the report before implementing that follow-up. Apply the follow-up with a failing regression where behavior changes, rebuild, and run the focused and relevant existing checks. Finish with a strong audit against the original finding and the strict-audit follow-up. Update the report with exact commands, outcomes, remaining limitations, and evidence. Never infer a pass from code inspection, never label estimates as exact, and do not close the cycle while a Critical or Important finding remains. Keep iterating until at least ten numbered cycles have each recorded both audits and their follow-up prompt/fix. After cycle ten, run the full available verification set, request an independent review, fix all Critical/Important findings, commit, and push the branch to the configured remote.

## Cycle 1 follow-up prompt

> The live observation protocol now works, but the strict audit found that closed tabs leave their live session in the service worker's in-memory manager. Add a regression that submits observations for two tabs, closes one tab through the registered `chrome.tabs.onRemoved` listener, and proves the closed tab no longer receives its session while the other tab remains intact. Also verify that a sender without a provider tab, a sender on a mismatched provider URL, and an oversized draft are rejected without mutating either session. Implement cleanup through `SessionManager.removeTab`, rebuild, run the focused regression, and record the strong audit result. Do not return a full storage snapshot from the content message path.

## Cycle 2 follow-up prompt

> The manager now stores one live session per tab, but strict review found that a negative integer tab id passes `Number.isInteger` and can enter the session map. Add a red regression proving the message boundary rejects `tab.id = -1`, and `SessionManager.setSession` rejects negative, non-safe-integer, and non-integer ids without changing existing sessions. Tighten the sender and manager validation, rebuild, rerun the complete focused live-capture regression, and record the strong audit evidence.

## Cycle 3 follow-up prompt

> Enter, native form submit, and click now share one capture path, but strict review found that the dedupe window can suppress a legitimate identical prompt after the user clears and retypes it quickly. Add a failing event regression for clear/retype of the same text, reset dedupe when composer input changes, and prove that duplicate send signals without an intervening edit still produce one capture. Rebuild, run the event and live-capture regressions, and record the strong audit evidence. Preserve Shift+Enter/IME handling and do not prevent the provider's default send action.

## Cycle 4 follow-up prompt

> Streaming completion now waits for stable text, but strict review found that the ten-minute timeout only runs during DOM updates. A request with no response or no further page mutations can remain pending indefinitely. Add a failing regression that submits a prompt, emits no response DOM update, advances past the ten-minute deadline, and proves pending state is abandoned with no commit. Schedule and clear a real deadline timer with the exchange lifecycle; retain the DOM-time check as a defense. Re-run quiet-stream, stop-control, cancel, navigation, timeout, and build checks, then record the strong audit.
