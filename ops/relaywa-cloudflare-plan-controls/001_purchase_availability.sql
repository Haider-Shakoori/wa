-- Run once against the production RelayWA Cloudflare D1 database, after
-- preserving a Time Travel recovery bookmark. Separate purchase visibility
-- from entitlement eligibility: changing subscription_plans.active is unsafe
-- because getSubscription joins on p.active=1 for existing subscribers.
ALTER TABLE subscription_plans ADD COLUMN available_for_purchase INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_relaywa_subscription_available
  ON subscription_plans(active, available_for_purchase);
