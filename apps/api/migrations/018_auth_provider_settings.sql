CREATE TABLE IF NOT EXISTS auth_provider_settings (
  provider varchar(32) PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  public_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_provider_settings_enabled
  ON auth_provider_settings (enabled);
