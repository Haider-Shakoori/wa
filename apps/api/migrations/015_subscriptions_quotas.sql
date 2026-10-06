CREATE TABLE IF NOT EXISTS subscription_plans (
  code varchar(40) PRIMARY KEY,
  name varchar(120) NOT NULL,
  max_sessions integer NOT NULL,
  monthly_messages integer NOT NULL,
  max_api_keys integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO subscription_plans (code, name, max_sessions, monthly_messages, max_api_keys)
VALUES
  ('trial', 'Trial', 1, 500, 2),
  ('starter', 'Starter', 3, 10000, 10),
  ('growth', 'Growth', 10, 50000, 50),
  ('scale', 'Scale', 50, 250000, 250)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code varchar(40) NOT NULL REFERENCES subscription_plans(code),
  status varchar(24) NOT NULL DEFAULT 'trialing',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  provider varchar(40),
  provider_customer_id varchar(190),
  provider_subscription_id varchar(190),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_subscriptions_status_check
    CHECK (status IN ('trialing','active','past_due','paused','canceled','expired'))
);

CREATE TABLE IF NOT EXISTS subscription_usage (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  metric varchar(40) NOT NULL,
  quantity bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, period_start, metric)
);

CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status
  ON organization_subscriptions (status, current_period_end);

CREATE INDEX IF NOT EXISTS idx_subscription_usage_org_period
  ON subscription_usage (organization_id, period_start);
