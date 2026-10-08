-- Global, operator-controlled OPTIONAL SQLite message-history archive.
-- PostgreSQL remains authoritative for dispatch, delivery status, usage,
-- subscriptions, and existing customer message-history endpoints.
-- Disabled until both an operator enables it and a persistent SQLite path
-- is explicitly provisioned. No historical messages are migrated by default.
CREATE TABLE IF NOT EXISTS message_history_storage_settings (
  id varchar(32) PRIMARY KEY DEFAULT 'global',
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  retention_days integer NOT NULL DEFAULT 7
    CHECK (retention_days BETWEEN 1 AND 365),
  max_file_mb integer NOT NULL DEFAULT 1024
    CHECK (max_file_mb BETWEEN 100 AND 102400),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_history_storage_settings_global CHECK (id='global')
);
INSERT INTO message_history_storage_settings(id) VALUES('global')
ON CONFLICT(id) DO NOTHING;
