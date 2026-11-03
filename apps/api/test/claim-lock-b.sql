BEGIN;
SELECT count(*) AS claimable_during_lock FROM (SELECT id FROM billing_notification_outbox WHERE event_key='staging-lock-test' FOR UPDATE SKIP LOCKED) locked;
ROLLBACK;
