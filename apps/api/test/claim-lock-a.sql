BEGIN;
SELECT id FROM billing_notification_outbox WHERE event_key='staging-lock-test' FOR UPDATE SKIP LOCKED;
SELECT pg_sleep(5);
ROLLBACK;
