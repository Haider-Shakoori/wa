-- Dedicated enterprise worker credentials. Tokens are generated outside SQL,
-- stored only as SHA-256 digests, and never returned by API responses.
-- This migration does not create workers, credentials or activate provisioning.
CREATE TABLE IF NOT EXISTS enterprise_worker_credentials (
  worker_id TEXT PRIMARY KEY REFERENCES enterprise_workers(worker_id) ON DELETE CASCADE,
  token_sha256 TEXT NOT NULL UNIQUE CHECK (token_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS enterprise_worker_credentials_active_idx
  ON enterprise_worker_credentials(worker_id) WHERE revoked_at IS NULL;
