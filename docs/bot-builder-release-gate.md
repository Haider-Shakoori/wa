# RelayWA Bot Builder — release gate

## Completed in isolated branch
- Separate Bot Builder subscription pricing and entitlements (Starter $5, Pro $12, Business $25 monthly).
- Stripe Checkout via existing RelayWA Stripe account; signed webhook verification, separate order ledger, mode separation.
- Checkout expiry/retry, replay protection, renewal invoice idempotency, cancellation fail-closed.
- Quota uses persisted billing-period start/end (migration 061), not calendar months. Existing subscriptions without an authoritative start fail closed until a verified renewal establishes one.
- Tenant-scoped standby bot/FAQ management, held-only replies with no outbound sender.
- Platform read-only subscription overview and dashboard checkout UI.
- Unit, runtime signature, Nest dependency injection, and isolated PostgreSQL lifecycle tests.

## Deferred by product owner: actual sandbox payment
Do not interpret this waiver as a successful payment test. Before public launch:
1. Apply migrations 056–061 to a dedicated staging database; never run them on production as a test.
2. Configure Stripe test-mode key, webhook signing secret, HTTPS return URLs, and enabled provider in staging.
3. Use an authenticated staging organization to POST /bots/checkout with {"planCode":"starter"}.
4. Complete a test-card payment on Stripe-hosted Checkout. Verify the signed checkout.session.completed event reaches the staging webhook and activates exactly one entitlement.
5. Replay the same event and confirm no duplicate entitlement; test invoice.paid renewal, invoice.payment_failed restriction, and customer.subscription.deleted cancellation.
6. Verify actual Stripe subscription item start/end during a paid sandbox checkout (code now retrieves the authoritative period), validate billing-cycle quota, and ensure the live outbound bot sender remains disabled until separately approved.
7. Check API and web CI, production migration backups, rollback, monitoring and release approval before merging/deploying.

No production migration, deployment, worker restart or live Stripe changes are authorized by this document.
