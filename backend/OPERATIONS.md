# Backend operations

## Deployment topology

Run the API and usage worker as separate long-lived container services from the same immutable image:

- API command: `/usr/local/bin/node dist/server.js`
- Worker command: `/usr/local/bin/node dist/jobs/usageWorker.js`
- One private Postgres database
- One persistent Redis deployment with Streams support
- One migration job per release: `npm run prisma:migrate`

This workload is not a good fit for request-only serverless hosting because the Redis Streams worker is intentionally long-lived. Use a container platform that supports private networking, health checks, graceful termination, and independently scaled process types.

## Release sequence

1. Build the pinned Docker image and record its digest.
2. Back up Postgres and verify the latest restore job.
3. Run `prisma migrate deploy` as a one-off job with the release image.
4. Deploy the API and wait for `/readyz` to return HTTP 200.
5. Deploy the worker and verify its Redis consumer group is advancing.
6. Scrape `/metrics` with the monitoring-only bearer token.
7. Run origin, JWT, idempotency, usage-ingest, sync, and quota smoke tests from the published extension.

Never run `prisma migrate dev` in production.

## Required secret/configuration controls

- Store `DATABASE_URL`, `REDIS_URL`, `LOG_HASH_SECRET`, and `METRICS_BEARER_TOKEN` in the platform secret manager.
- Allow only the production extension origin in `ALLOWED_EXTENSION_ORIGINS`.
- Use HTTPS OIDC issuer and JWKS endpoints and a dedicated API audience.
- Keep Postgres and Redis off the public internet.
- Set `TRUST_PROXY=true` only when every direct connection comes from a trusted reverse proxy that overwrites forwarding headers.

The process rejects placeholder production values at startup.

## Health and alerting

- `/healthz`: process liveness only.
- `/readyz`: Postgres and Redis connectivity; remove the instance from traffic on failure.
- `/metrics`: protected Prometheus output.

Alert on sustained readiness failures, API 5xx rate above 1%, p95 latency above 500 ms, Redis stream lag above 60 seconds, dead-letter growth, database pool saturation, and unusual 401/403/429 spikes.

## Failure response

### Postgres unavailable

The API readiness check fails and authenticated data routes return controlled server errors. Keep the instance out of rotation. Do not drain or acknowledge queued usage until Postgres recovers.

### Redis unavailable

Rate limiting fails closed with HTTP 503 and usage enqueueing stops. Local extension capture continues and retries after connectivity returns.

### OIDC/JWKS unavailable

Previously cached JWKS material may continue to validate briefly; uncached validation fails with HTTP 401. Do not bypass signature, issuer, or audience validation.

### Poison usage job

The worker retries with bounded exponential backoff and moves the job to `usage-events:dead` after five failed deliveries. Inspect and remediate the payload or code before replaying it.

## Rollback

1. Stop rollout and retain the failing image and logs.
2. Re-deploy the last known-good image digest for API and worker.
3. Do not reverse a database migration unless a reviewed down-migration exists and data loss has been assessed.
4. For additive migrations, keep the previous application version schema-compatible through the rollback window.
5. Verify `/readyz`, authentication, ingest, worker consumption, sync, and metrics after rollback.

## Backup and restore

Use encrypted automated Postgres backups with point-in-time recovery where available. Test restore into an isolated database on a schedule; a successful backup job without a restore test is not recovery evidence. Redis is not the durable source of truth for usage records, but persistence is required to avoid losing queued work during ordinary restarts.
