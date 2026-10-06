ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS whatsapp_jid varchar(180),
  ADD COLUMN IF NOT EXISTS profile_picture_url text,
  ADD COLUMN IF NOT EXISTS profile_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS connection_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconnect_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_connection_error text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_jid
  ON whatsapp_sessions (whatsapp_jid)
  WHERE whatsapp_jid IS NOT NULL AND deleted_at IS NULL;
