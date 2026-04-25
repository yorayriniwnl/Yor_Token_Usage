# Repository Instructions

## Architecture
- `content/network-interceptor.js` — Runs in MAIN world (page context). Wraps fetch/XHR to intercept real token counts and rate-limit headers from AI API responses. Dispatches `YOR_NETWORK_TOKENS` CustomEvents to the isolated-world content script. Must run at `document_start`.
- `content/index.js` — Isolated-world content script. Listens for `YOR_NETWORK_TOKENS`, drives the overlay UI, collects DOM messages, dispatches to service worker.
- `background/service-worker.js` — Handles all state persistence, quota tracking, badge updates, and message routing. Uses a keepalive alarm (`yor-keepalive`, 0.4 min) to prevent MV3 worker termination during active sessions.
- `popup/`, `dashboard/`, `settings/` — Extension UI pages.

## Key design decisions
- **Real token counts first**: The `network-interceptor.js` intercepts AI API SSE streams and JSON responses to extract exact token counts. Heuristic estimation is a fallback only.
- **Cost snapshotted at write time**: `costUsd` is stored on each `UsageEvent` at the time it is recorded. Never recalculate historical costs — pricing changes should not retroactively alter records.
- **Cumulative context tracking**: `estimateConversation()` tracks the running total of all tokens sent to the model (full history re-sent each turn), not per-message sums.
- **Adapter health checks**: If `collectMessages()` returns 0 in a known conversation, a health warning surfaces in the overlay.

## Development workflow
1. Make changes in feature branches, not directly on main.
2. Run `npm test` in `backend/` before committing backend changes.
3. To test the extension: load `yor_fixed/` as an unpacked extension in Chrome (Developer mode → Load unpacked).
4. Use `git add -p` and commit logical units with descriptive messages.
5. Push only when a complete feature or fix is ready — do not push intermediate states.
6. The CI pre-commit hook runs the backend test suite automatically.

## Model catalog maintenance
The `MODEL_CATALOG` in `background/service-worker.js` must only contain models verified to exist. Run monthly against OpenAI `/v1/models` and Anthropic's model list. Do NOT add speculative future models.
