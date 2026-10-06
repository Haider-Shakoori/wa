ALTER TABLE whatsapp_messages
  ALTER COLUMN recipient_phone DROP NOT NULL,
  ALTER COLUMN recipient_jid DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS sender_phone varchar(32),
  ADD COLUMN IF NOT EXISTS sender_jid varchar(180),
  ADD COLUMN IF NOT EXISTS chat_jid varchar(180),
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_type_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_type_check
  CHECK (
    message_type IN (
      'text','image','video','audio','document',
      'reply','reaction','location','contact','poll','unknown'
    )
  );

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('queued','claimed','sent','failed','received'));

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_payload_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_payload_check
  CHECK (
    direction = 'inbound'
    OR
    (message_type = 'text' AND text_body IS NOT NULL)
    OR
    (message_type IN ('image','video','audio','document') AND media_url IS NOT NULL)
    OR
    (message_type IN ('reply','reaction','location','contact','poll') AND action_payload <> '{}'::jsonb)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_messages_inbound_provider
  ON whatsapp_messages (session_id, provider_message_id)
  WHERE direction = 'inbound' AND provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_inbound_received
  ON whatsapp_messages (session_id, received_at DESC)
  WHERE direction = 'inbound';

CREATE INDEX IF NOT EXISTS idx_session_events_org_session_id
  ON whatsapp_session_events (organization_id, session_id, id);
