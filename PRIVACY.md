# Yor Token Usage privacy and data handling

This document records the behavior implemented by version 1.1.0. It is an engineering disclosure for operators and reviewers. Before public distribution, the publishing entity must add its legal identity, contact address, jurisdiction-specific rights process, final retention schedule, and obtain appropriate legal review.

## Local browser data

By default, Yor works locally. It stores preferences, active session estimates, thread aggregates, notification timing, and at most 2,500 normalized usage events in Chrome extension storage. A local usage event can include provider, model, thread identifier, timestamps, token estimates, status, and a bounded prompt preview used by the local interface.

If the user selects **Sync preferences**, preferences are also written to Chrome's sync storage. That browser-vendor sync path is separate from the optional Yor backend.

Users can export or import their local state, restore default preferences, and clear local usage history from Settings. Clearing local history preserves preferences and does not delete data that was previously uploaded to an optional backend.

## Optional backend data

Cloud sync is off until the user enters a backend URL, grants host access for that origin, and supplies a short-lived OIDC bearer token. The token is held in `chrome.storage.session`, is excluded from exports, and is cleared on disconnect or when the browser session ends.

Eligible uploads contain token counts, provider, model, thread identifier, timestamp, completion status, estimate accuracy, and bounded measurement provenance: schema version, method, level, confidence, error margin, tokenizer label, and source label. The current extension measurement is a visible-DOM approximation; a provider reset signal is not a provider-reported token count. Prompt text, prompt previews, prompt hashes, and arbitrary event metadata are not uploaded by the extension cloud client. The backend can additionally store the OIDC subject, email claim, extension-install metadata, settings, quota aggregates, subscription status, and security/diagnostic records. IP addresses, user agents, and diagnostic stacks are stored only as keyed hashes where implemented.

The extension does not upload local events older than 90 days. The backend repository does not yet implement an automatic server-data retention job or a complete self-service account-deletion workflow; operators must define and implement those before public production use.

## Permissions and network behavior

Yor requests access to supported AI sites so its content script can estimate usage. Optional backend host access is requested only after a user enters a backend origin and chooses to connect. Cloud requests use HTTPS except for explicit localhost development, omit browser credentials, reject redirects, and use bounded timeouts.

The project contains no advertising SDK, cross-site analytics SDK, or sale-of-data path. Backend operators can change that fact only by changing the code and must update this disclosure and obtain fresh user consent where required.

## Security and incident handling

Production operators must use a real OIDC provider, an exact published-extension origin allowlist, managed secrets, HTTPS, supported Postgres and Redis services, monitoring, tested backups, and the runbook in `backend/OPERATIONS.md`. A public privacy notice must provide a monitored security and privacy contact; no contact is fabricated in this repository.
