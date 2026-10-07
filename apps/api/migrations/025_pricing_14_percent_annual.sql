-- Annual billing saves 14% against twelve monthly payments.
UPDATE subscription_plans
SET monthly_price_cents = pricing.monthly_cents,
    annual_price_cents = pricing.annual_cents,
    updated_at = now()
FROM (VALUES
  ('starter', 300, 3096),
  ('growth', 800, 8256),
  ('plus', 1800, 18576),
  ('scale', 2500, 25800)
) AS pricing(code, monthly_cents, annual_cents)
WHERE subscription_plans.code = pricing.code;
