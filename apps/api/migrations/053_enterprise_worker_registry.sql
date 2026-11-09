-- Enterprise worker registry for the PostgreSQL migration schema.
-- Ensure imported D1 enterprise accounts can be referenced by a foreign key.
CREATE UNIQUE INDEX IF NOT EXISTS enterprise_accounts_id_uidx ON enterprise_accounts(id);

CREATE TABLE IF NOT EXISTS enterprise_workers (
  enterprise_account_id TEXT PRIMARY KEY REFERENCES enterprise_accounts(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL,
  worker_id TEXT NOT NULL UNIQUE,
  container_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','provisioning','ready','failed','disabled')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_heartbeat_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT enterprise_workers_account_org_unique UNIQUE(enterprise_account_id, organization_id)
);
CREATE INDEX IF NOT EXISTS enterprise_workers_org_idx ON enterprise_workers(organization_id);
CREATE INDEX IF NOT EXISTS enterprise_workers_pending_idx
  ON enterprise_workers(status, updated_at) WHERE status IN ('pending','failed');

CREATE OR REPLACE FUNCTION relaywa_register_enterprise_worker()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO enterprise_workers(enterprise_account_id, organization_id, worker_id, container_name, status)
  VALUES (NEW.id, NEW.organization_id, 'enterprise-' || NEW.organization_id,
          'relaywa-enterprise-' || NEW.organization_id, 'pending')
  ON CONFLICT (enterprise_account_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS relaywa_enterprise_worker_registration ON enterprise_accounts;
CREATE TRIGGER relaywa_enterprise_worker_registration
AFTER INSERT ON enterprise_accounts
FOR EACH ROW EXECUTE FUNCTION relaywa_register_enterprise_worker();

INSERT INTO enterprise_workers(enterprise_account_id, organization_id, worker_id, container_name, status)
SELECT id, organization_id, 'enterprise-' || organization_id,
       'relaywa-enterprise-' || organization_id, 'pending'
FROM enterprise_accounts
ON CONFLICT (enterprise_account_id) DO NOTHING;
