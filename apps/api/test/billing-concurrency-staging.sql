-- Run only on isolated staging; uses a transaction that is rolled back.
BEGIN;
DO $$
DECLARE org uuid; item uuid:=gen_random_uuid(); n integer;
BEGIN
 SELECT id INTO org FROM organizations LIMIT 1;
 INSERT INTO billing_notification_outbox(id,organization_id,event_key,kind) VALUES(item,org,'staging-concurrency-'||item,'test');
 UPDATE billing_notification_outbox SET attempts=1,claim_worker_id='worker-a',claim_expires_at=now()+interval '2 minutes',next_attempt_at=now()+interval '2 minutes' WHERE id=item;
 UPDATE billing_notification_outbox SET status='sent' WHERE id=item AND status='pending' AND claim_worker_id='worker-b' AND claim_expires_at>now();
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Other worker acknowledged claim'; END IF;
 UPDATE billing_notification_outbox SET attempts=2,claim_worker_id='worker-b',claim_expires_at=now()+interval '2 minutes' WHERE id=item;
 UPDATE billing_notification_outbox SET status='sent' WHERE id=item AND status='pending' AND claim_worker_id='worker-a' AND claim_expires_at>now();
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Stale worker acknowledged reassigned claim'; END IF;
 UPDATE billing_notification_outbox SET status='failed' WHERE id=item AND status='pending' AND attempts=1 AND claim_worker_id='worker-b' AND claim_expires_at>now();
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Stale attempt marked failed'; END IF;
 UPDATE billing_notification_outbox SET status='sent' WHERE id=item AND status='pending' AND claim_worker_id='worker-b' AND claim_expires_at>now();
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Current worker acknowledgement rejected'; END IF;
 RAISE NOTICE 'Reassignment and stale attempt checks passed';
END $$;
ROLLBACK;
