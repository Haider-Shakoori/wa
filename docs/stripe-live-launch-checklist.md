# RelayWA: controlled Stripe live launch

## Current state and safety boundary

The existing deployed `relaywa.com` runtime is using `sk_test_...`. The production database also contains a successfully paid **sandbox** Growth subscription. Those test objects do **not** exist in Stripe live mode. Keep real charges disabled until the Stripe account is verified, billing policies and tax treatment are confirmed, and the new release passes tests.

`STRIPE_MODE=test` is the default. `STRIPE_MODE=live` requires a live **server-side** API key (`sk_live_...` or restricted `rk_live_...`) and a live endpoint's `whsec_...` signing secret. Mismatch **fails closed**, and invalid or unsigned webhook requests return HTTP 400. Existing Stripe test payments are retained with `stripe_livemode=false`; paid live payments are recorded separately. Live Checkout is not blocked by a prior active test subscription for the same workspace. When live Checkout succeeds, the single current subscription row transitions to live mode, while test payment history remains available. A live payment period starts at payment time rather than extending from a test-only expiry.

## Prerequisites — MUST complete before enabling real charges

1. Verify the correct Stripe **Canadian** account and its legal ownership/individual business eligibility. Check that its dashboard shows **payments enabled** and review `charges_enabled`, `payouts_enabled`, `requirements.currently_due` and `requirements.past_due`. Do not infer readiness from successful sandbox payments.
2. Confirm the public business identity, customer service contact, terms/privacy/refund/cancellation policies, statement descriptor, payout bank account, and tax responsibilities. Automatic Stripe Tax must not be enabled merely because the account is Canadian.
3. Keep Stripe-hosted Checkout, USD plan currency, monthly/annual dynamic recurring `price_data`. Don't deploy the temporary `RelayWA isolated recurring smoke fixture` product.
4. In Stripe **live mode** create a live webhook event destination `https://relaywa.com/api/billing/stripe/webhook` subscribing to:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   Copy the **new live destination's** signing secret; test-mode secrets cannot verify live events.
5. Store the live `sk_live_` or `rk_live_` API key and live `whsec_` signing secret in an access-controlled, reviewed deployment environment or secret manager; **never paste them into a chat, GitHub issue, source file or logs**. Do not overwrite existing sandbox secrets or run the sandbox-only provisioning workflow with live credentials.
   If using `rk_live_`, make sure the key can create Checkout Sessions and Billing Portal Sessions and has read access to account details and webhook endpoint listings (these are used by the activation preflight). The key can be restricted further after validating the actual API calls using Stripe's per-key request logs. GitHub's encrypted environment secret remains named `STRIPE_LIVE_SECRET_KEY` for either key type. Never use the public `pk_live_` client key for server authentication.
6. Verify SMTP or Stripe live receipts before promising customer email delivery. The RelayWA billing mailer remains disabled until SMTP is configured.
7. Before any VPS change, take a fresh PostgreSQL backup and snapshot `compose.yml`, `.env.production`, and current running image; retain rollback resources. Database migration `044_stripe_environment_separation.sql` must be applied **before** deploying the new API.
8. Deploy the code to a **staging environment with a separate database**, validate sandbox webhook, portal, renewal, failure and cancellation handling, and confirm existing tenant data remains intact.

## Controlled cutover (requires operator approval)

1. Schedule a change window. Disable new subscription purchases while keys and containers are changed, but keep existing app traffic online if possible.
2. Deploy the tested code + migration, with `STRIPE_MODE=test` and current test keys; verify sandbox regression and old test subscription visibility.
3. Obtain explicit operator sign-off for live charges and verify live account state and live webhook destination.
4. Atomically install `STRIPE_MODE=live`, `STRIPE_SECRET_KEY=sk_live_...` **or `rk_live_...`**, and `STRIPE_WEBHOOK_SECRET=whsec_...` in the protected VPS production environment. Avoid accidentally copying sandbox keys. Restart API/web/worker using **`docker compose -p deploy --env-file .env.production`** (never create a second Compose project).
5. Verify `/api/health`, authenticated billing provider live mode, correct redirect URLs and webhook signature failures (HTTP 400). Watch Stripe Event Destinations for verified **live** deliveries.
6. After authorized confirmation of amount, use one small real purchase on a designated test workspace/card (not a Stripe test card) to verify a real initial payment, a real invoice and active live subscription. This **will charge money** and incurs possible Stripe fees. Do not initiate it without explicit approval and a valid account.
7. Check card management portal, live receipt delivery, payout setup, cancellation notification and ledger reconciliation. Do not expect a sandbox test subscription/card to appear in the live portal.

## Rollback

If no real payment occurred, restore saved image/config and set `STRIPE_MODE=test` with test credentials. If a real payment **has occurred**, do not blindly downgrade while live subscriptions are active: that can strand payment records and leave renewing customers unmanaged. Freeze new sales, investigate/reconcile live Stripe charges and subscriptions, then perform a planned rollback retaining a path to process live webhooks.

## Not yet validated

- Periodically reconfirm live account eligibility, charges/payouts, tax and registration obligations.
- Validate restricted-key API permissions and the live webhook signing secret in the approved activation run.
- First real charge, refund and payout.
- Fully integrated failed automatic renewal, recovery and cancellation webhooks for RelayWA.
- Customer receipt email delivery (Stripe live receipt settings vs RelayWA SMTP).
