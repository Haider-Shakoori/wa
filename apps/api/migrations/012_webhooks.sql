CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret varchar(128) NOT NULL,
  event_types text[] NOT NULL DEFAULT ARRAY['*']::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY,
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_event_id bigint NOT NULL REFERENCES whatsapp_session_events(id) ON DELETE CASCADE,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','delivering','delivered','retry','failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_status_code integer,
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (webhook_id, session_event_id)
);
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks (organization_id, active);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_queue ON webhook_deliveries (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_created ON webhook_deliveries (organization_id, created_at DESC);
