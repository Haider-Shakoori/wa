-- Enterprise platform controls. Existing administrators retain full access on migration.
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role varchar(32);
UPDATE users SET platform_role = 'super_admin'
 WHERE is_platform_admin = true AND platform_role IS NULL;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspension_reason varchar(500);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_suspended ON organizations(suspended_at) WHERE suspended_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS platform_login_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  outcome varchar(24) NOT NULL CHECK (outcome IN ('success','failed')),
  login_method varchar(24) NOT NULL DEFAULT 'password',
  ip_address varchar(64),
  user_agent varchar(256),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_login_events_recent ON platform_login_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_login_events_user ON platform_login_events(user_id, created_at DESC);
