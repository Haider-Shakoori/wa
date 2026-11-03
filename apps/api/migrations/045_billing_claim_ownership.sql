ALTER TABLE billing_notification_outbox ADD COLUMN IF NOT EXISTS claim_worker_id varchar(120);
ALTER TABLE billing_notification_outbox ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;
