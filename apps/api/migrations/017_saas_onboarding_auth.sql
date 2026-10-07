CREATE TABLE IF NOT EXISTS user_auth_identities (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider varchar(32) NOT NULL,
  provider_subject varchar(320) NOT NULL,
  provider_email varchar(320),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subject),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_user
  ON user_auth_identities (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'onboarding_step'
  ) THEN
    ALTER TABLE organizations
      ADD COLUMN onboarding_step varchar(32) NOT NULL DEFAULT 'complete',
      ADD COLUMN onboarding_completed_at timestamptz,
      ADD COLUMN selected_plan_code varchar(40),
      ADD COLUMN selected_billing_interval varchar(16);

    UPDATE organizations
    SET onboarding_step = 'complete',
        onboarding_completed_at = COALESCE(onboarding_completed_at, now());

    ALTER TABLE organizations
      ALTER COLUMN onboarding_step SET DEFAULT 'plan';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_onboarding_step_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_onboarding_step_check
      CHECK (onboarding_step IN ('plan','payment','workspace','connect','api_key','test','webhook','complete'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_billing_interval_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_billing_interval_check
      CHECK (selected_billing_interval IS NULL OR selected_billing_interval IN ('monthly','annual'));
  END IF;
END $$;
