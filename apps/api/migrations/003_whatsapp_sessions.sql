CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name varchar(120) NOT NULL,
  phone_hint varchar(40),
  phone_number varchar(40),
  display_name varchar(160),
  status varchar(24) NOT NULL DEFAULT 'pending',
  worker_id varchar(120),
  worker_lease_expires_at timestamptz,
  last_heartbeat_at timestamptz,
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  auth_state jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_sessions_status_check CHECK (
    status IN (
      'pending','need_scan','connecting','connected','disconnected',
      'reconnecting','logged_out','expired','error'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_sessions_org_name
  ON whatsapp_sessions (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_org_status
  ON whatsapp_sessions (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_worker_lease
  ON whatsapp_sessions (worker_id, worker_lease_expires_at)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS whatsapp_session_commands (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  command varchar(24) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'queued',
  worker_id varchar(120),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT whatsapp_session_commands_command_check
    CHECK (command IN ('connect','restart','logout')),
  CONSTRAINT whatsapp_session_commands_status_check
    CHECK (status IN ('queued','claimed','completed','failed'))
);

CREATE INDEX IF NOT EXISTS idx_session_commands_queue
  ON whatsapp_session_commands (status, created_at);

CREATE TABLE IF NOT EXISTS whatsapp_session_events (
  id bigserial PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  event_type varchar(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_events_session_created
  ON whatsapp_session_events (session_id, created_at DESC);
