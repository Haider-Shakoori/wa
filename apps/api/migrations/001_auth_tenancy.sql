CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email varchar(320) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  password_hash varchar(255) NOT NULL,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY,
  name varchar(160) NOT NULL,
  slug varchar(190) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(40) NOT NULL DEFAULT 'member',
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_status
  ON organization_memberships (user_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_org
  ON organization_memberships (organization_id);
