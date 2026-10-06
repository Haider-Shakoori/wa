ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS recovery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_recovery_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_reason varchar(80);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_recovery
  ON whatsapp_sessions (status, worker_lease_expires_at)
  WHERE deleted_at IS NULL
    AND status IN ('connecting','connected','reconnecting','disconnected');
