-- Dedicated heartbeat-only credentials for standby standard workers.
-- This registry is intentionally separate from enterprise credentials and
-- cannot authorize session, command, message, or recovery endpoints.
CREATE TABLE IF NOT EXISTS relaywa_standby_worker_credentials (
  worker_id varchar(120) PRIMARY KEY,
  token_sha256 char(64) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
