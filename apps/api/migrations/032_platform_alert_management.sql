-- Alert acknowledgements are separate from delivery status and never stop worker notification dispatch.
ALTER TABLE system_alerts ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
ALTER TABLE system_alerts ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_system_alerts_open_recent
  ON system_alerts (created_at DESC) WHERE acknowledged_at IS NULL;
