ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS daily_messages integer;

UPDATE subscription_plans
SET
  name = 'Trial',
  max_sessions = 1,
  daily_messages = 50,
  monthly_messages = 350,
  max_api_keys = 2,
  monthly_price_cents = 0,
  annual_price_cents = 0,
  currency = 'USD',
  active = true,
  updated_at = now()
WHERE code = 'trial';

UPDATE subscription_plans
SET
  name = 'Basic',
  max_sessions = 1,
  daily_messages = NULL,
  monthly_messages = 30000,
  max_api_keys = 5,
  monthly_price_cents = 399,
  annual_price_cents = 4070,
  currency = 'USD',
  active = true,
  updated_at = now()
WHERE code = 'starter';

UPDATE subscription_plans
SET
  name = 'Pro',
  max_sessions = 3,
  daily_messages = NULL,
  monthly_messages = 100000,
  max_api_keys = 15,
  monthly_price_cents = 899,
  annual_price_cents = 9170,
  currency = 'USD',
  active = true,
  updated_at = now()
WHERE code = 'growth';

INSERT INTO subscription_plans
  (code, name, max_sessions, daily_messages, monthly_messages, max_api_keys,
   monthly_price_cents, annual_price_cents, currency, active)
VALUES
  ('plus', 'Plus', 6, NULL, 250000, 30, 1699, 17330, 'USD', true)
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  max_sessions = EXCLUDED.max_sessions,
  daily_messages = EXCLUDED.daily_messages,
  monthly_messages = EXCLUDED.monthly_messages,
  max_api_keys = EXCLUDED.max_api_keys,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  annual_price_cents = EXCLUDED.annual_price_cents,
  currency = EXCLUDED.currency,
  active = EXCLUDED.active,
  updated_at = now();

UPDATE subscription_plans
SET
  name = 'Business',
  max_sessions = 10,
  daily_messages = NULL,
  monthly_messages = 500000,
  max_api_keys = 50,
  monthly_price_cents = 2499,
  annual_price_cents = 25490,
  currency = 'USD',
  active = true,
  updated_at = now()
WHERE code = 'scale';
