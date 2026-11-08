-- Durable event receipt ledger for Cloudflare-verified Stripe forwarding.
-- A failed delivery is retryable; an already completed event is not reprocessed.
CREATE TABLE IF NOT EXISTS stripe_forwarded_event_receipts (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  stripe_livemode boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('processing','completed')),
  lease_until timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

[executed on device: businessos-dev-vps (9b1cdbf1-1a02-4fe8-9e81-8871c3eca22c)]