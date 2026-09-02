# Yor Token Usage

Yor is a Manifest V3 Chrome extension for estimating and reviewing AI token usage across ChatGPT, Claude, Gemini, Perplexity, and Grok.

## Product boundary

Yor is local-first by default. Usage history, sessions, and preferences are stored in Chrome storage; the popup, dashboard, settings page, exports, notifications, and overlay do not require an account or network service.

Version 1.1 adds an opt-in backend transport in Settings. A connected extension can upload bounded usage counters in idempotent batches, pull recent usage from other devices, and read server quota state. Prompt text and prompt previews are never included. The bearer token is kept only in `chrome.storage.session` and is excluded from exports. Local capture continues when the backend is unavailable.

This repository does not embed a hosted identity-provider client or production credentials. Until a real OIDC provider, API URL, and published extension ID are configured, the cloud panel is an advanced integration surface rather than a turnkey consumer sign-in flow. Billing remains read-only status infrastructure; there is no purchase or webhook flow.

The current data inventory, user controls, retention limitations, and publication requirements are documented in [PRIVACY.md](./PRIVACY.md). That document is an engineering disclosure, not a substitute for entity-specific legal review before a public store listing.

## Measurement contract

Yor currently measures visible composer and response text with a deterministic DOM-text heuristic. Every estimate carries a measurement level, method, confidence, tokenizer, source, and error bound; the current level is `approximation`, not provider-authoritative. A provider UI reset signal is tracked separately and never upgrades a token count to exact.

The current calibration uses a 20-sample corpus covering English, Hindi, Hinglish, code, Markdown, JSON, Unicode, math, URLs, and large mixed prompts. Against `gpt-tokenizer@4.0.0` using the OpenAI `o200k_base` reference, the measured worst case is 37.61% and the displayed bound is ±40%. This reference does not include hidden system context, tools, images, provider-specific serialization, or billing counters. See the [calibration report](./docs/accuracy-benchmark.md), or regenerate it with `npm run accuracy:benchmark -- --write`.

The backend stores the same provenance fields and returns them through sync. Cloud uploads contain counters and measurement metadata only; prompt text, previews, hashes, and arbitrary local metadata remain local.

## Verify the extension

From PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-extension.ps1 -Output "$env:TEMP\yor-token-usage.zip"
```

The verifier checks every shipped JavaScript file, parses the Manifest V3 manifest, exercises hostile imports and the cloud transport contract, and packages the extension. Load the resulting ZIP contents or the project folder through `chrome://extensions` with Developer mode enabled.

## Verify the backend

The backend requires Node 22+, PostgreSQL, Redis, an OIDC/JWKS provider, and environment variables from `backend/.env.example`. For the complete local database/auth/API integration check on Windows with Docker Desktop:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\backend\scripts\verify-local-stack.ps1
```

The isolated stack binds Postgres to `127.0.0.1:55433` and Redis to `127.0.0.1:56379`, preserving services already using the standard ports. It applies the production migration to `yor_tokens_test`, seeds the free plan, runs the authenticated integration suite, builds the production container, and shuts down containers without deleting their volumes.

For a separately managed Postgres/Redis environment, copy `.env.example` to `.env`, fill in real values, then run:

```powershell
Set-Location .\backend
npm ci
npm run verify
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

`npm run verify` performs Prisma validation/format checks, client generation, a strict TypeScript build, and the unit suite. See `backend/OPERATIONS.md` for deployment topology, migration, rollback, and incident procedures.

For the extension contract checks:

```powershell
npm ci
npm run design:check
npm run accuracy:benchmark
```
