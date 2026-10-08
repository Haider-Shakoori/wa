CREATE TABLE IF NOT EXISTS platform_admin_audit_logs (
  id uuid PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL,
  target_type varchar(64) NOT NULL,
  target_id varchar(160) NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_audit_recent ON platform_admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_target ON platform_admin_audit_logs (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_actor ON platform_admin_audit_logs (actor_user_id, created_at DESC);
