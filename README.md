# YOR // Token Usage

YOR Token Usage is a Manifest V3 browser extension with a local-first popup, dashboard, settings page, content-site overlay, and an optional Fastify/Prisma/Redis backend for synchronized usage data. The extension surfaces usage signals across supported AI sites without claiming provider billing or token-counter authority.

## Evidence boundary

| Surface | Status | Evidence boundary |
| --- | --- | --- |
| Extension manifest, popup, dashboard, settings, content, and service worker source | VERIFIED | Checked-in source and package script are present. |
| YOR visual contract across extension surfaces | VERIFIED | `npm run design:check` checks all three CSS surfaces and the manifest. |
| Local usage aggregation and copy/export interactions | DEMO | Browser-extension runtime and supported-site DOMs are required for end-to-end behavior. |
| Fastify routes, Prisma schema, quota policy, sync, and usage queue | REPORTED | Source and unit tests define the boundary; configured PostgreSQL/Redis are required for provider-backed execution. |
| Provider token counts, billing, notifications, and hosted API | EXPERIMENTAL | Integrations depend on site DOM changes, credentials, deployment, and external service state. |
| Production extension distribution and backend operations | UNVERIFIED | No store publication or hosted availability claim is made. |
| Cross-provider reconciliation and operational hardening | PLANNED | Verify before public release. |

## Local checks

```powershell
npm run design:check
cd backend
npm ci
npm run prisma:generate
npm run verify
```

The backend requires the variables in `backend/.env.example`. Keep tokens, database URLs, Redis credentials, and signing secrets out of Git. The extension may be packaged with `scripts/package-extension.ps1`; inspect the generated artifact before distribution.

## Visual contract

- Void `#000000`, graphite `#050505`, crimson `#e84b4b`, deep crimson `#671515`
- Signal `#ff8a7f`, warm white `#f5eaea`, muted `#c4c4c4`
- Field gradient `#671515 → #8c1616 → #2a0505`
- Square panels and controls, visible focus states, grid/noise field, reduced-motion fallback

## Scope notes

The extension estimates usage from supported interfaces and/or configured backend events. It is not an official billing meter. Treat values as signals until independently reconciled with provider usage records.
