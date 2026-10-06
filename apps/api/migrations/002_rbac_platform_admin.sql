ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_memberships_role_check'
  ) THEN
    ALTER TABLE organization_memberships
      ADD CONSTRAINT organization_memberships_role_check
      CHECK (role IN ('owner', 'admin', 'developer', 'member', 'viewer'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_platform_admin
  ON users (is_platform_admin)
  WHERE is_platform_admin = true;
