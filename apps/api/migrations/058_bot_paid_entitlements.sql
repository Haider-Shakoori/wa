-- Billing foundation only. Stripe must provision entitlements after verified
-- payment; no free access is granted by this migration.
CREATE TABLE IF NOT EXISTS relaywa_bot_entitlements (
 organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 plan_code varchar(24) NOT NULL CHECK (plan_code IN ('starter','pro','business')),
 status varchar(24) NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','expired')),
 max_bots integer NOT NULL CHECK (max_bots IN (1,3,10)),
 monthly_reply_limit integer NOT NULL CHECK (monthly_reply_limit IN (1000,5000,20000)),
 stripe_subscription_id varchar(255) UNIQUE,
 trial_ends_at timestamptz,
 current_period_end timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((plan_code='starter' AND max_bots=1 AND monthly_reply_limit=1000)
     OR (plan_code='pro' AND max_bots=3 AND monthly_reply_limit=5000)
     OR (plan_code='business' AND max_bots=10 AND monthly_reply_limit=20000))
);
