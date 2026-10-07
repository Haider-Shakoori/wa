CREATE TABLE IF NOT EXISTS oauth_login_codes (
  id uuid PRIMARY KEY,
  code_hash char(64) NOT NULL UNIQUE,
  provider varchar(32) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_login_codes_lookup
  ON oauth_login_codes (code_hash, expires_at)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_oauth_login_codes_user
  ON oauth_login_codes (user_id, created_at DESC);
