ALTER TABLE whatsapp_messages
  ALTER COLUMN text_body DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_mime_type varchar(160),
  ADD COLUMN IF NOT EXISTS media_file_name varchar(255),
  ADD COLUMN IF NOT EXISTS media_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS media_caption text,
  ADD COLUMN IF NOT EXISTS voice_note boolean NOT NULL DEFAULT false;

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_type_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_type_check
  CHECK (message_type IN ('text','image','video','audio','document'));

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_payload_check
  CHECK (
    (message_type = 'text' AND text_body IS NOT NULL)
    OR
    (message_type IN ('image','video','audio','document') AND media_url IS NOT NULL)
  );
