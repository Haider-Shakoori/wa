-- This deployment's existing Stripe records originate from Stripe sandbox.
-- Record environment on all future Stripe payments/subscriptions to prevent
-- test identifiers blocking live Checkout or being used in the live Billing Portal.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_livemode boolean NOT NULL DEFAULT false;
ALTER TABLE organization_subscriptions ADD COLUMN IF NOT EXISTS stripe_livemode boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN payments.stripe_livemode IS 'Stripe mode at transaction creation (false=sandbox, true=live).';
COMMENT ON COLUMN organization_subscriptions.stripe_livemode IS 'Stripe mode of currently linked customer/subscription. Not used for manual plans.';
