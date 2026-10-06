CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  session_id uuid NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  jid varchar(180) NOT NULL,
  phone_number varchar(32),
  display_name varchar(180),
  notify_name varchar(180),
  verified_name varchar(180),
  is_business boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, jid)
);

CREATE TABLE IF NOT EXISTS whatsapp_chats (
  session_id uuid NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  jid varchar(180) NOT NULL,
  chat_type varchar(16) NOT NULL,
  name varchar(255),
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, jid)
);

CREATE TABLE IF NOT EXISTS whatsapp_groups (
  session_id uuid NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  jid varchar(180) NOT NULL,
  subject varchar(255),
  owner_jid varchar(180),
  participant_count integer NOT NULL DEFAULT 0,
  announce boolean NOT NULL DEFAULT false,
  restrict_members boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_org_session
  ON whatsapp_contacts (organization_id, session_id, display_name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_org_session
  ON whatsapp_chats (organization_id, session_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_org_session
  ON whatsapp_groups (organization_id, session_id, subject);
