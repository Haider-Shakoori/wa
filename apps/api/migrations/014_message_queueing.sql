ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS bull_job_id varchar(180),
  ADD COLUMN IF NOT EXISTS rate_limited_until timestamptz;

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('queued','scheduled','claimed','retrying','sent','failed','received'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_dispatch_ready
  ON whatsapp_messages (status, next_attempt_at, priority, queued_at)
  WHERE direction = 'outbound' AND status IN ('queued','scheduled','retrying');
