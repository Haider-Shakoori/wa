CREATE TABLE IF NOT EXISTS system_alerts (
  id uuid PRIMARY KEY,
  event_type varchar(80) NOT NULL,
  severity varchar(16) NOT NULL DEFAULT 'warning',
  dedupe_key varchar(240) NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  session_id uuid REFERENCES whatsapp_sessions(id) ON DELETE SET NULL,
  resource_type varchar(48),
  resource_id varchar(160),
  subject varchar(240) NOT NULL,
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  worker_id varchar(160),
  claimed_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_alerts_severity_check CHECK (severity IN ('info','warning','critical')),
  CONSTRAINT system_alerts_status_check CHECK (status IN ('queued','sending','sent','failed'))
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_queue
  ON system_alerts (status, next_attempt_at, created_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_system_alerts_dedupe
  ON system_alerts (dedupe_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_alerts_session
  ON system_alerts (session_id, created_at DESC)
  WHERE session_id IS NOT NULL;
