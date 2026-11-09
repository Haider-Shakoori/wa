# Enterprise worker release gate (not yet authorized for production)

## Architecture
- Marketing website and Stripe checkout/webhooks remain on Cloudflare.
- API and PostgreSQL remain on VPS; dedicated enterprise workers must use scoped HTTPS API, not PostgreSQL.
- Do not use the legacy shared-worker runtime for an `enterprise-*` identity.
- Set `ENTERPRISE_STRIPE_MODE=live` or `test` on the API from the **verified** Cloudflare billing environment; this controls dispatch authorization only and does not move Stripe.
- Keep workers pending until every check below is green.

## Required implementation before activation
1. Implement enterprise-specific Baileys runtime adapter for session storage, inbound messages, contacts/chats/groups, outbound queue, command processing, QR/status, media, and recovery. Existing `SessionStore` uses direct SQL; the enterprise API client is **not** a drop-in replacement.
2. Add atomic enterprise command discovery and claim with session lease ownership, not only claim by supplied command ID.
3. Ensure message claim and poll return the fields needed for actual delivery; validate all SQL against the complete migrated schema.
4. Add worker supervisor and secure secret injection; no plaintext token in logs, images, environment dumps, or source control. Isolate auth directories per tenant.
5. Add independent credential rotation, revocation, and container restart handling with audited operator approval.
6. Ensure leases and stale worker recovery do not seize active shared-worker sessions during cutover.

## Isolated acceptance matrix
- Start an enterprise worker with an isolated PostgreSQL test fixture and dedicated WhatsApp test number.
- Wrong/revoked token, disabled worker, missing billing mode, cross-tenant session/message IDs: denied.
- QR appears; phone connects; session status and lease renew correctly.
- Outbound message sent exactly once; inbound message recorded once, retries idempotent.
- Command connect/restart/logout and worker crash/restart preserve auth state.
- Worker rotation/revocation takes effect without affecting other tenants.
- Confirm Stripe billing eligibility from VPS state synchronized with Cloudflare, including live/test segregation.
- Verify worker process cannot access PostgreSQL or another tenant's auth files.
- Run full API/worker tests and PostgreSQL integration tests; record commit SHA and evidence.

## Release sequence
1. Backup PostgreSQL and WhatsApp authentication files. Confirm restore and rollback.
2. Apply migrations in staging and compare schema; never mutate production while testing.
3. Deploy candidate API and one dedicated worker in isolation; leave existing workers unchanged.
4. Observe heartbeat, message flow, recovery, billing checks and logs. Only then approve first tenant activation.
5. Roll back by disabling dedicated worker and restoring previous routing/lease assignment; never delete session auth directories.

**Release status: BLOCKED** until runtime adapter, provisioning supervisor and acceptance matrix are completed.
