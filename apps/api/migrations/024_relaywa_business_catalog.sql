ALTER TABLE subscription_plans ALTER COLUMN monthly_messages DROP NOT NULL;
UPDATE subscription_plans SET monthly_price_cents = 600, annual_price_cents = 6120,
  monthly_messages = NULL, updated_at = now() WHERE code = 'starter';
UPDATE subscription_plans SET monthly_price_cents = 1500, annual_price_cents = 15300,
  monthly_messages = NULL, updated_at = now() WHERE code = 'growth';
UPDATE subscription_plans SET monthly_price_cents = 3000, annual_price_cents = 30600,
  monthly_messages = NULL, updated_at = now() WHERE code = 'plus';
UPDATE subscription_plans SET monthly_price_cents = 4500, annual_price_cents = 45900,
  monthly_messages = NULL, updated_at = now() WHERE code = 'scale';
UPDATE subscription_plans SET monthly_messages = 150, updated_at = now() WHERE code = 'trial';
