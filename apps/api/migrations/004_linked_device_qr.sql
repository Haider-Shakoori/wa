ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS qr_code text,
  ADD COLUMN IF NOT EXISTS qr_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_qr_expiry
  ON whatsapp_sessions (qr_expires_at)
  WHERE qr_code IS NOT NULL AND deleted_at IS NULL;
