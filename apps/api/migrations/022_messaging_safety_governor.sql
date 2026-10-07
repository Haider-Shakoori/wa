CREATE TABLE IF NOT EXISTS messaging_safety_settings (
  id varchar(32) PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  min_delay_ms integer NOT NULL DEFAULT 2500,
  max_delay_ms integer NOT NULL DEFAULT 5000,
  messages_per_minute integer NOT NULL DEFAULT 20,
  messages_per_hour integer NOT NULL DEFAULT 300,
  burst_limit integer NOT NULL DEFAULT 5,
  burst_window_seconds integer NOT NULL DEFAULT 10,
  duplicate_window_seconds integer NOT NULL DEFAULT 60,
  retry_base_ms integer NOT NULL DEFAULT 5000,
  max_attempts integer NOT NULL DEFAULT 5,
  max_queue_age_seconds integer NOT NULL DEFAULT 3600,
  failure_pause_threshold integer NOT NULL DEFAULT 5,
  failure_window_seconds integer NOT NULL DEFAULT 300,
  auto_pause_seconds integer NOT NULL DEFAULT 900,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messaging_safety_min_delay_check CHECK (min_delay_ms >= 1000 AND min_delay_ms <= 60000),
  CONSTRAINT messaging_safety_max_delay_check CHECK (max_delay_ms >= min_delay_ms AND max_delay_ms <= 120000),
  CONSTRAINT messaging_safety_minute_check CHECK (messages_per_minute BETWEEN 1 AND 120),
  CONSTRAINT messaging_safety_hour_check CHECK (messages_per_hour BETWEEN 1 AND 5000),
  CONSTRAINT messaging_safety_burst_check CHECK (burst_limit BETWEEN 1 AND 50),
  CONSTRAINT messaging_safety_burst_window_check CHECK (burst_window_seconds BETWEEN 1 AND 60),
  CONSTRAINT messaging_safety_duplicate_window_check CHECK (duplicate_window_seconds BETWEEN 0 AND 3600),
  CONSTRAINT messaging_safety_retry_check CHECK (retry_base_ms BETWEEN 1000 AND 60000),
  CONSTRAINT messaging_safety_attempts_check CHECK (max_attempts BETWEEN 1 AND 10),
  CONSTRAINT messaging_safety_queue_age_check CHECK (max_queue_age_seconds BETWEEN 60 AND 86400),
  CONSTRAINT messaging_safety_failure_threshold_check CHECK (failure_pause_threshold BETWEEN 2 AND 20),
  CONSTRAINT messaging_safety_failure_window_check CHECK (failure_window_seconds BETWEEN 60 AND 3600),
  CONSTRAINT messaging_safety_pause_check CHECK (auto_pause_seconds BETWEEN 60 AND 86400)
);

INSERT INTO messaging_safety_settings (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE whatsapp_sessions
  ADD COLUMN IF NOT EXISTS messaging_paused_until timestamptz,
  ADD COLUMN IF NOT EXISTS messaging_pause_reason text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_messaging_pause
  ON whatsapp_sessions (messaging_paused_until)
  WHERE messaging_paused_until IS NOT NULL;
