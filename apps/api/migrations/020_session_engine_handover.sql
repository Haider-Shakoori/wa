ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS next_engine varchar(16);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_sessions_next_engine_check'
  ) THEN
    ALTER TABLE whatsapp_sessions
      ADD CONSTRAINT whatsapp_sessions_next_engine_check
      CHECK (next_engine IS NULL OR next_engine IN ('baileys', 'chromium'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_next_engine
  ON whatsapp_sessions (next_engine)
  WHERE next_engine IS NOT NULL AND deleted_at IS NULL;
