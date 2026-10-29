# RelayWA SDK API coverage audit

Verified against backend controllers and SDK source on main (2026-10-29). This is a **coverage audit**, not a claim that every backend endpoint is intended for every SDK or permission tier.

| API capability | TypeScript | PHP | Python | .NET |
| --- | --- | --- | --- | --- |
| Send text | Yes | Yes | Yes | Yes |
| Send image/video/audio/document | Yes | Yes | Yes | Yes |
| List sessions | Yes | Yes | Yes | Yes |
| Get session / QR | Yes | No | No | No |
| Session contacts/chats/groups | Yes | No | No | No |
| Session messages | Yes | No | No | No |
| Create/update/delete webhook | Yes | Yes | Yes | Yes |
| List webhook deliveries | Yes | Yes | Yes | Yes |
| Verify worker webhook signature | Yes | Yes | Yes | Yes |
| Send location/contact/poll/reply/reaction | No | No | No | No |
| Create/update/delete/connect/restart/disconnect session | No | No | No | No |
| Session statistics/logs | No | No | No | No |

## Backend route evidence

- `apps/api/src/messages/send-message.controller.ts`: send-message, send-image, send-video, send-audio, send-document, send-location, send-contact, send-poll, send-reply, send-reaction.
- `apps/api/src/sessions/sessions.controller.ts`: session list/create/read/update/delete, QR, statistics, logs, connect/restart/disconnect/logout.
- `apps/api/src/directory/directory.controller.ts`: contacts, chats, groups.
- `apps/api/src/webhooks/webhooks.controller.ts`: endpoint CRUD and deliveries.
- `apps/worker/src/webhook-crypto.js`: HMAC-SHA256 signing contract.

## Suggested safe order

1. Bring **read-only session details, QR, contacts, chats, groups, and messages** to PHP, Python, and .NET using verified routes and mock HTTP tests.
2. Add **send location/contact/poll/reply/reaction** only after reviewing DTO validation and permissions.
3. Add **session lifecycle management** with explicit opt-in and caution around disconnect/logout/delete; never run tests against live sessions.
4. Normalize errors, cancellation/timeout handling, request IDs, and idempotency across SDKs.
5. Final test vectors, examples, documentation, release dry-runs, and controlled publishing.

**Production isolation:** no API, worker, database, deployment, or customer session changes are needed for this audit.
