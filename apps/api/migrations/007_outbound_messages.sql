CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  client_message_id varchar(120),
  direction varchar(16) NOT NULL DEFAULT 'outbound',
  message_type varchar(24) NOT NULL DEFAULT 'text',
  recipient_phone varchar(32) NOT NULL,
  recipient_jid varchar(180) NOT NULL,
  text_body text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'queued',
  worker_id varchar(120),
  provider_message_id varchar(180),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_messages_direction_check CHECK (direction IN ('outbound','inbound')),
  CONSTRAINT whatsapp_messages_type_check CHECK (message_type IN ('text')),
  CONSTRAINT whatsapp_messages_status_check CHECK (status IN ('queued','claimed','sent','failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_messages_client_id
  ON whatsapp_messages (organization_id, session_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_outbound_queue
  ON whatsapp_messages (status, queued_at)
  WHERE direction = 'outbound';

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_session_created
  ON whatsapp_messages (session_id, created_at DESC);
