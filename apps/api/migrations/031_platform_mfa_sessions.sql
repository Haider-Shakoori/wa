-- Phase 6C: opt-in authenticator MFA and revocable user sessions.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret_ciphertext text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_pending_ciphertext text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_hashes jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled_at timestamptz;

CREATE TABLE IF NOT EXISTS user_login_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  login_method varchar(24) NOT NULL,
  ip_address varchar(64),
  user_agent varchar(256),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_user_login_sessions_user ON user_login_sessions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_mfa_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES organization_memberships(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  login_method varchar(24) NOT NULL,
  ip_address varchar(64),
  user_agent varchar(256),
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_mfa_challenges_expiry ON platform_mfa_challenges(expires_at);
