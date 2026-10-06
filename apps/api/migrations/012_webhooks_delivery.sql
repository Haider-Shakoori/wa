CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  url text NOT NULL,
  secret_encrypted text NOT NULL,
  event_types text[] NOT NULL DEFAULT ARRAY['*']::text[],
  enabled boolean NOT NULL DEFAULT true,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_endpoints_org_name
  ON webhook_endpoints (organization_id, lower(name));

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY,
  endpoint_id uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_event_id bigint NOT NULL REFERENCES whatsapp_session_events(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  worker_id varchar(120),
  response_status integer,
  response_body text,
  last_error text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_deliveries_status_check
    CHECK (status IN ('queued','claimed','delivered','failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_delivery_event_endpoint
  ON webhook_deliveries (endpoint_id, session_event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_queue
  ON webhook_deliveries (status, next_attempt_at, queued_at)
  WHERE status IN ('queued','claimed');

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_created
  ON webhook_deliveries (endpoint_id, queued_at DESC);
