# Yor Token Usage Backend

Production backend for a browser extension that tracks token usage, syncs settings, enforces quotas, and accepts diagnostics.

This is intentionally not a toy architecture. It assumes paying users, hostile clients, malformed imports, replay attempts, noisy extensions, and cost ceilings.

## 1. Backend Requirements Audit

Required services:

- Auth: OIDC/JWT auth from Clerk, Auth0, Cognito, Supabase Auth, or another JWKS-based provider. The extension must never mint trusted user identity by itself.
- Database: Postgres for users, devices, settings, usage events, quota windows, subscriptions, API logs, audit logs, and error logs.
- Cache/rate limit store: Redis for IP/user/device rate limits, idempotency acceleration, queues, and short-lived cached settings.
- Queue: Redis Streams for usage ingestion. Usage tracking should not synchronously block extension UX.
- Background workers: Durable usage ingestion and quota aggregation.
- Billing/quota: Plan and subscription tables, quota window aggregation, spend caps.
- API proxying: Only add later if absolutely needed. If proxying model APIs, isolate it behind separate budgets and never store raw API keys without KMS envelope encryption.
- Logs/analytics: Structured API request logs with HMAC-hashed IP/user-agent. No prompt bodies in logs.
- Sync across devices: Settings and recent usage state endpoints keyed by authenticated user and install/device.
- Error reporting: Authenticated diagnostics endpoint with rate limits and stack hashing.
- Observability: Prometheus metrics, structured logs, traces through deployment provider, alerts on 5xx, queue lag, DB pool saturation, and rate-limit spikes.

## 2. Recommended Architecture

```text
Browser Extension
  -> Fastify API Server
    -> Postgres via Prisma
    -> Redis for rate limits/cache/idempotency
    -> Redis Streams usage queue
      -> Usage Worker
        -> usage_events + quota_windows
  -> Auth Provider via OIDC/JWKS
  -> Observability: logs + metrics + traces + alerts
  -> Secrets: cloud secret manager + KMS
```

Components:

- API server: Validates auth, extension origin, request bodies, rate limits, and returns quick responses.
- Postgres: Durable source of truth. Indexes are designed around user/time and provider/model/time queries.
- Redis: Fast abuse controls and queue backend. Redis failure should degrade non-critical endpoints, but ingest should fail closed for abuse controls in production.
- Usage worker: Accepts queued Redis Stream batches, reclaims stale pending entries, idempotently writes events, aggregates quota windows, and dead-letters repeated failures.
- Auth provider: Issues user JWTs. Backend validates `issuer`, `audience`, and JWKS signature.
- Observability: Metrics at `/metrics`, API request logs in DB, app logs in JSON.
- Secrets: `.env` only in local dev. Production uses cloud secret manager. User secrets go in `user_secrets` encrypted with KMS envelope keys.

## 3. Security Model

Authentication:

- Every user endpoint requires a Bearer JWT.
- JWT must validate against configured `AUTH_ISSUER`, `AUTH_AUDIENCE`, and `AUTH_JWKS_URL`.
- Users are mapped by immutable auth subject, not email.
- Auth subject to user ID mapping is cached in Redis; DB `last_seen_at` and email refreshes are throttled instead of written on every request.

Authorization:

- Every query is scoped by `request.auth.userId`.
- Devices are scoped by `(userId, installId)`.
- Cross-user IDs from clients are ignored.

Extension validation:

- CORS allows only `ALLOWED_EXTENSION_ORIGINS`.
- `Origin` is required on API routes.
- `X-Extension-Id` and `X-Install-Id` are required for device-bound operations.
- Extension origin validation is defense-in-depth only; JWT auth is the real trust boundary.

Secrets/API keys:

- The extension should not send third-party API keys unless the user explicitly opts in.
- If API keys are stored, store only encrypted ciphertext in `user_secrets`.
- Encrypt with cloud KMS envelope encryption. Do not log, return, or cache raw keys.

Rate limits:

- Global IP limit: 600 req/min.
- Auth session: 30 req/min.
- Settings: 120 req/min.
- Usage ingest: 120 batches/min/user, max 100 events/batch.
- Sync: 60 req/min/user.
- Diagnostics: 30 req/min/user.

Abuse prevention:

- Idempotency keys on usage batch ingest.
- Unique `(userId, clientEventId)` to dedupe replayed events.
- Max event age: 90 days. Max future skew: 5 minutes.
- Max tokens/event: bounded by schema.
- Logs hash IP/user-agent.
- Prompt bodies are not stored, only optional prompt hashes/previews should stay client-side unless user opts in.

Least privilege:

- API role can read/write app tables only.
- Worker role can write usage/quota tables.
- Metrics endpoint protected by bearer token.
- Backups encrypted.
- Production DB access via private network only.

## 4. Database Schema

The Prisma schema is in `prisma/schema.prisma` and includes:

- `users`
- `extension_installs`
- `user_settings`
- `usage_events`
- `quota_windows`
- `plans`
- `subscriptions`
- `api_request_logs`
- `error_logs`
- `audit_logs`
- `idempotency_keys`
- `user_secrets`

For very high write volume, partition `usage_events` monthly by `occurred_at` and keep the Prisma model as the logical interface.

## 5. API Contract

All endpoints require:

- `Origin: chrome-extension://<allowed-extension-id>`
- `Authorization: Bearer <jwt>` except health/metrics
- Device headers for device-aware endpoints:
  - `X-Install-Id`
  - `X-Extension-Id`
  - `X-Extension-Version`
  - `X-Browser`
  - `X-Platform`

### GET `/v1/auth/session`

Auth: required.
Rate limit: 30/min/token.

Response:

```json
{
  "user": { "id": "uuid", "email": "user@example.com" },
  "device": { "id": "uuid", "installId": "install-id", "status": "ACTIVE" },
  "plan": null,
  "subscription": null,
  "serverTime": "2026-04-24T00:00:00.000Z"
}
```

### GET `/v1/settings`

Auth: required.
Rate limit: 120/min/user.

Response:

```json
{
  "settings": {
    "version": 1,
    "payload": { "preferences": {} },
    "updatedAt": "2026-04-24T00:00:00.000Z"
  }
}
```

### PUT `/v1/settings`

Auth: required.
Rate limit: 120/min/user.

Request:

```json
{
  "version": 2,
  "payload": {
    "version": 2,
    "preferences": {}
  }
}
```

`version` is the next settings version. The write succeeds only when the stored version is exactly `version - 1`; the first settings write must use version `1`.

Response: same as GET.

Conflict response:

```json
{
  "error": "settings_version_conflict",
  "message": "Settings were updated by another client. Fetch the latest settings and retry.",
  "expectedVersion": 3,
  "currentSettings": {
    "version": 2,
    "payload": { "version": 2, "preferences": {} },
    "updatedAt": "2026-04-24T00:00:00.000Z"
  }
}
```

### POST `/v1/usage/events/batch`

Auth: required.
Rate limit: 120 batches/min/user.
Headers: `Idempotency-Key` recommended.

Request:

```json
{
  "events": [
    {
      "clientEventId": "evt_abc12345",
      "provider": "claude",
      "model": "sonnet-4.6",
      "threadId": "thread-1",
      "occurredAt": "2026-04-24T00:00:00.000Z",
      "promptTokens": 120,
      "outputTokens": 300,
      "totalTokens": 420,
      "promptHash": "64-char-sha256-hex",
      "status": "COMPLETED",
      "accuracy": "ESTIMATED",
      "metadata": {}
    }
  ]
}
```

Response:

```json
{
  "accepted": 1,
  "queued": true,
  "requestId": "req-id"
}
```

Validation:

- 1-100 events per batch.
- Provider `[a-z0-9_-]`, max 40 chars.
- Model max 120 chars.
- `totalTokens >= promptTokens + outputTokens`.
- Event not older than 90 days.
- Event not more than 5 minutes in the future.

### GET `/v1/quota/check?provider=claude&model=sonnet-4.6`

Auth: required.
Rate limit: 180/min/user.

Response:

```json
{
  "usedTokens": 1000,
  "tokenCap": 100000,
  "remainingTokens": 99000,
  "limited": false,
  "periodStart": "2026-04-01T00:00:00.000Z",
  "periodEnd": "2026-05-01T00:00:00.000Z",
  "periodSource": "calendar_month",
  "windows": []
}
```

### GET `/v1/billing/status`

Auth: required.
Rate limit: 60/min/user.

Response:

```json
{
  "subscription": null,
  "plan": null
}
```

### POST `/v1/sync/state`

Auth: required.
Rate limit: 60/min/user.

Request:

```json
{
  "since": "2026-04-24T00:00:00.000Z",
  "includeUsage": true,
  "maxEvents": 100
}
```

Response:

```json
{
  "serverTime": "2026-04-24T00:00:00.000Z",
  "settings": null,
  "usageEvents": []
}
```

### POST `/v1/diagnostics/errors`

Auth: required.
Rate limit: 30/min/user.

Request:

```json
{
  "source": "content",
  "severity": "error",
  "message": "Something failed",
  "stack": "optional stack",
  "context": {}
}
```

Response:

```json
{ "accepted": true }
```

## 6. Reliability

- Usage ingestion is async through Redis Streams.
- Usage events are deduped by `(userId, clientEventId)`.
- Batch requests support `Idempotency-Key`; expired idempotency rows are swept by a Redis-locked cleanup job.
- Worker retries 5 times with exponential backoff.
- API uses bounded body sizes and request validation.
- Extension should buffer usage events locally and retry with exponential backoff.
- Extension should never block chat UX on backend availability.
- Settings reads can be cached client-side and refreshed opportunistically.

## 7. Performance

- Usage writes are batched.
- Quota aggregation is done in the worker.
- Rate limits use Redis counters, not Postgres.
- Auth user lookup uses Redis caching with periodic DB refreshes.
- API request logging is fire-and-forget.
- Settings reads are one-row lookups.
- Avoid hot rows by using `(user, provider, model, windowStart)` quota windows. At larger scale, bucket quota windows by hour and aggregate for display.

## 8. Observability

- Structured JSON app logs via Fastify/Pino.
- DB `api_request_logs` for product/security analytics.
- `/metrics` for Prometheus default process metrics.
- Add deployment-level traces with OpenTelemetry before production launch.
- Alerts:
  - p95 API latency > 500ms for 10 minutes
  - 5xx rate > 1%
  - queue lag > 60 seconds
  - Redis errors
  - Postgres connection saturation
  - sudden 429 spike
  - usage ingest failures

## 9. Abuse and Cost Control

- Per-IP and per-user throttles.
- Per-device identity and revocation.
- Batch size caps.
- Token/event caps.
- Subscription plan caps.
- Diagnostics caps.
- No raw prompt storage by default.
- Audit logs for settings changes.
- Spend cap policy: if monthly cap is exceeded, accept local-only extension tracking but reject paid proxy calls and mark quota limited.

## 10. Folder Structure

```text
backend/
  prisma/schema.prisma
  src/
    app.ts
    server.ts
    config/env.ts
    jobs/usageQueue.ts
    jobs/usageWorker.ts
    lib/prisma.ts
    lib/redis.ts
    lib/security.ts
    middleware/auth.ts
    middleware/errors.ts
    middleware/extensionOrigin.ts
    middleware/rateLimit.ts
    middleware/requestLog.ts
    routes/
    schemas/
    services/
```

## 11. Deployment Checklist

- Create production Postgres with private networking.
- Create Redis with persistence suitable for queues.
- Configure auth provider and JWT audience.
- Set `ALLOWED_EXTENSION_ORIGINS` to the production extension ID only.
- Set all secrets in cloud secret manager, not `.env` files.
- Run `npm ci`.
- Run `npm run prisma:generate`.
- Run `npm run prisma:migrate`.
- Deploy API service with at least 2 instances.
- Deploy usage worker separately with autoscaling by queue lag.
- Protect `/metrics` with `METRICS_BEARER_TOKEN`.
- Configure log drain and alerting.
- Configure DB backups and restore drills.
- Load test usage ingestion with realistic batch sizes.
- Verify CORS from the real published extension ID.
- Verify rejected origins, invalid JWTs, replayed idempotency keys, and over-limit users.
