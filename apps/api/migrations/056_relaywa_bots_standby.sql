-- Storage only. No triggers, outbound sends, worker leases or session ownership changes.
CREATE TABLE IF NOT EXISTS relaywa_bots (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 session_id uuid NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
 created_by_user_id uuid NOT NULL REFERENCES users(id),
 name varchar(120) NOT NULL,
 mode varchar(16) NOT NULL DEFAULT 'standby' CHECK (mode='standby'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,session_id),
 UNIQUE(id,organization_id)
);
CREATE INDEX IF NOT EXISTS idx_relaywa_bots_org ON relaywa_bots(organization_id);
CREATE TABLE IF NOT EXISTS relaywa_bot_faqs (
 id uuid PRIMARY KEY,
 organization_id uuid NOT NULL,
 bot_id uuid NOT NULL,
 question varchar(500) NOT NULL,
 answer varchar(4000) NOT NULL,
 aliases jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(aliases)='array'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(bot_id,organization_id) REFERENCES relaywa_bots(id,organization_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_relaywa_bot_faqs_org_bot ON relaywa_bot_faqs(organization_id,bot_id);
