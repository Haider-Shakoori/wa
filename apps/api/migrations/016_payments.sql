ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS monthly_price_cents integer,
  ADD COLUMN IF NOT EXISTS annual_price_cents integer,
  ADD COLUMN IF NOT EXISTS currency varchar(3) NOT NULL DEFAULT 'USD';

UPDATE subscription_plans SET monthly_price_cents = 900, annual_price_cents = 9000 WHERE code = 'starter' AND monthly_price_cents IS NULL;
UPDATE subscription_plans SET monthly_price_cents = 2900, annual_price_cents = 29000 WHERE code = 'growth' AND monthly_price_cents IS NULL;
UPDATE subscription_plans SET monthly_price_cents = 7900, annual_price_cents = 79000 WHERE code = 'scale' AND monthly_price_cents IS NULL;
UPDATE subscription_plans SET monthly_price_cents = 0, annual_price_cents = 0 WHERE code = 'trial' AND monthly_price_cents IS NULL;

CREATE TABLE IF NOT EXISTS payment_provider_settings (
  provider varchar(40) PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO payment_provider_settings (provider, enabled, public_config)
VALUES
  ('stripe', false, '{}'::jsonb),
  ('manual', true, '{"instructions":"Contact relayWA support for payment instructions."}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code varchar(40) NOT NULL REFERENCES subscription_plans(code),
  provider varchar(40) NOT NULL,
  billing_interval varchar(16) NOT NULL DEFAULT 'monthly',
  status varchar(24) NOT NULL DEFAULT 'pending',
  amount_cents integer NOT NULL,
  currency varchar(3) NOT NULL,
  provider_payment_id varchar(190),
  provider_checkout_id varchar(190),
  manual_reference varchar(255),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_interval_check CHECK (billing_interval IN ('monthly','annual')),
  CONSTRAINT payments_status_check CHECK (status IN ('pending','paid','failed','canceled','refunded'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_checkout
  ON payments (provider, provider_checkout_id)
  WHERE provider_checkout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_org_created
  ON payments (organization_id, created_at DESC);
