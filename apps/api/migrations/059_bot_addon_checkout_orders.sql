-- Isolated Bot Builder checkout ledger. Does not touch core subscription tables.
CREATE TABLE IF NOT EXISTS relaywa_bot_checkout_orders (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 plan_code varchar(24) NOT NULL CHECK (plan_code IN ('starter','pro','business')),
 amount_cents integer NOT NULL CHECK (amount_cents IN (500,1200,2500)),
 currency varchar(3) NOT NULL DEFAULT 'USD' CHECK (currency='USD'),
 stripe_livemode boolean NOT NULL,
 stripe_checkout_id varchar(255) UNIQUE,
 status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,organization_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_checkout_pending_org_mode
 ON relaywa_bot_checkout_orders(organization_id,stripe_livemode) WHERE status='pending';
