CREATE TABLE IF NOT EXISTS messaging_engine_settings (
  id varchar(32) PRIMARY KEY,
  default_engine varchar(16) NOT NULL DEFAULT 'baileys',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messaging_engine_settings_engine_check
    CHECK (default_engine IN ('baileys', 'chromium'))
);

INSERT INTO messaging_engine_settings (id, default_engine)
VALUES ('global', 'baileys')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS engine varchar(16) NOT NULL DEFAULT 'baileys';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_sessions_engine_check'
  ) THEN
    ALTER TABLE whatsapp_sessions
      ADD CONSTRAINT whatsapp_sessions_engine_check
      CHECK (engine IN ('baileys', 'chromium'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_engine
  ON whatsapp_sessions (engine)
  WHERE deleted_at IS NULL;
