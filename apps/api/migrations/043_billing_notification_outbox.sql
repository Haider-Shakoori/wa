-- Durable, deduplicated billing events for future mail delivery / audit.
-- Delivery is disabled until a verified mail provider is configured.
CREATE TABLE IF NOT EXISTS billing_notification_outbox (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_key varchar(240) NOT NULL UNIQUE,
  kind varchar(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  CONSTRAINT billing_outbox_status CHECK (status IN ('pending','sent','failed'))
);
CREATE INDEX IF NOT EXISTS idx_billing_outbox_pending
 ON billing_notification_outbox(created_at) WHERE status='pending';
