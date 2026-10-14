-- Public plan availability is separate from subscriber entitlement eligibility.
-- Disabling purchases must not revoke access for existing subscriptions.
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS available_for_purchase boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS subscription_plans_available_for_purchase_idx
  ON subscription_plans (available_for_purchase)
  WHERE active = true;
