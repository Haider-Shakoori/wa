# Webhook API contract (source-verified)

Backend controller prefix: `/api/webhooks` (alias `/api/v1/webhooks`).

| Method | Route | Permission |
|---|---|---|
| GET | /api/webhooks | WEBHOOKS_READ |
| GET | /api/webhooks/:endpointId/deliveries | WEBHOOKS_READ |
| POST | /api/webhooks | WEBHOOKS_MANAGE |
| PATCH | /api/webhooks/:endpointId | WEBHOOKS_MANAGE |
| DELETE | /api/webhooks/:endpointId | WEBHOOKS_MANAGE |

Create requires `name` (2–120 characters) and HTTPS `url`; optional `eventTypes` up to 32 strings, 64 characters each. Update allows `name`, `url`, `eventTypes`, and `enabled`. The service generates a 32-byte secret, encrypts it for storage, and returns it in the create response; treat it as sensitive. Deliveries are limited to the 100 most recent records. Existing TypeScript SDK exposes only read operations. **Do not assume webhook signature format from this controller**: signing/verification must be independently checked against the worker delivery implementation before introducing a verifier.

No live webhook calls are part of the tests.
