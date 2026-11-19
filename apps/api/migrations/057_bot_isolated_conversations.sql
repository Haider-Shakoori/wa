-- Schema-only foundation: no production session claims, triggers, sends or workers.
-- Every row is tenant-scoped and references a bot in the same organization.
CREATE TABLE IF NOT EXISTS relaywa_bot_conversations (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL,
 bot_id uuid NOT NULL,
 chat_id varchar(256) NOT NULL,
 human_takeover boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,bot_id,chat_id),
 FOREIGN KEY(bot_id,organization_id) REFERENCES relaywa_bots(id,organization_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS relaywa_bot_outbox (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL,
 bot_id uuid NOT NULL,
 session_id uuid NOT NULL,
 chat_id varchar(256) NOT NULL,
 inbound_message_id varchar(128) NOT NULL,
 response_text varchar(4000) NOT NULL,
 status varchar(16) NOT NULL DEFAULT 'held' CHECK(status='held'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,bot_id,inbound_message_id),
 FOREIGN KEY(bot_id,organization_id) REFERENCES relaywa_bots(id,organization_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_relaywa_bot_outbox_held
 ON relaywa_bot_outbox(organization_id,bot_id,created_at);
