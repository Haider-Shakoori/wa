CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id uuid REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  key_prefix varchar(32) NOT NULL,
  key_hash varchar(64) NOT NULL UNIQUE,
  token_type varchar(20) NOT NULL DEFAULT 'organization',
  scopes text[] NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT api_keys_type_check CHECK (token_type IN ('organization','session'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_org_name
  ON api_keys (organization_id, lower(name))
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_org_active
  ON api_keys (organization_id, enabled, revoked_at);

CREATE INDEX IF NOT EXISTS idx_api_keys_session
  ON api_keys (session_id)
  WHERE session_id IS NOT NULL AND revoked_at IS NULL;
