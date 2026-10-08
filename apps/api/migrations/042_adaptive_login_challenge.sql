-- Adaptive login protection: shared across API containers.
-- Store only pseudonymous HMAC identifiers; never store email, IP or password
-- in the counter table. Allow old windows to be purged independently.
CREATE TABLE IF NOT EXISTS auth_login_attempt_windows (
  lookup_hash char(64) PRIMARY KEY,
  failed_count integer NOT NULL DEFAULT 0 CHECK(failed_count>=0),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  last_failed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_login_attempt_windows_last_failed
  ON auth_login_attempt_windows(last_failed_at);
