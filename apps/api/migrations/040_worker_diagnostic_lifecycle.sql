-- Persist the worker process heartbeat independently from WhatsApp session leases.
-- A disconnected or idle session should not be used to infer process health.
CREATE TABLE IF NOT EXISTS relaywa_worker_heartbeats (
  worker_id varchar(190) PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_relaywa_worker_heartbeats_last_seen
  ON relaywa_worker_heartbeats(last_seen_at DESC);

-- Manual diagnostics archiving is an auditable annotation, never data deletion.
-- If a failed row changes after archiving, its newest failure is visible again.
CREATE TABLE IF NOT EXISTS platform_diagnostic_archives (
  resource_type varchar(20) NOT NULL CHECK (resource_type IN ('session','message','webhook')),
  resource_id uuid NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_by uuid NOT NULL REFERENCES users(id),
  reason varchar(500) NOT NULL,
  PRIMARY KEY(resource_type,resource_id)
);

-- Email notification delivery status is separate from incident resolution.
ALTER TABLE system_alerts ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_system_alerts_unresolved
  ON system_alerts(created_at DESC) WHERE resolved_at IS NULL;
