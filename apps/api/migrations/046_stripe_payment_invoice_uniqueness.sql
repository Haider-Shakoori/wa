-- Prevent concurrent Stripe renewal retries from inserting the same invoice twice.
-- The preflight intentionally fails rather than silently discarding existing payments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM payments
    WHERE provider_payment_id IS NOT NULL
    GROUP BY provider, provider_payment_id, stripe_livemode
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate provider payment IDs exist; resolve before applying migration 046';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_payment_mode
  ON payments (provider, provider_payment_id, stripe_livemode)
  WHERE provider_payment_id IS NOT NULL;
