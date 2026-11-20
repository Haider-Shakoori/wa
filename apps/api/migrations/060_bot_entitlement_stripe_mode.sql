-- Separate test/live Stripe identities; no existing entitlement is granted.
ALTER TABLE relaywa_bot_entitlements
 ADD COLUMN IF NOT EXISTS stripe_livemode boolean;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_entitlement_stripe_identity
 ON relaywa_bot_entitlements(stripe_subscription_id,stripe_livemode)
 WHERE stripe_subscription_id IS NOT NULL;

-- Idempotency ledger for bot subscription renewal invoices.
CREATE TABLE IF NOT EXISTS relaywa_bot_renewal_events (
 stripe_invoice_id varchar(255) NOT NULL,
 stripe_livemode boolean NOT NULL,
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(stripe_invoice_id,stripe_livemode)
);
