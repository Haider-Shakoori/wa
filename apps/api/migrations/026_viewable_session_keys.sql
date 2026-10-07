ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS token_encrypted text;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS uq_auto_session_key ON api_keys(session_id) WHERE auto_generated AND revoked_at IS NULL;
