ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS action_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_type_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_type_check
  CHECK (
    message_type IN (
      'text','image','video','audio','document',
      'reply','reaction','location','contact','poll'
    )
  );

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_payload_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_payload_check
  CHECK (
    (message_type = 'text' AND text_body IS NOT NULL)
    OR
    (message_type IN ('image','video','audio','document') AND media_url IS NOT NULL)
    OR
    (message_type IN ('reply','reaction','location','contact','poll') AND action_payload <> '{}'::jsonb)
  );
