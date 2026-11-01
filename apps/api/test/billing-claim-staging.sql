-- Staging-only, rollback-only PostgreSQL ownership checks.
BEGIN;
DO $$
DECLARE org uuid; item uuid:=gen_random_uuid(); changed integer;
BEGIN
 SELECT id INTO org FROM organizations LIMIT 1;
 IF org IS NULL THEN RAISE EXCEPTION 'Staging has no organization'; END IF;
 INSERT INTO billing_notification_outbox(id,organization_id,event_key,kind) VALUES(item,org,'staging-ownership-'||item,'test');
 UPDATE billing_notification_outbox SET claim_worker_id='worker-a',claim_expires_at=now()+interval '2 minutes',attempts=1,next_attempt_at=now()+interval '2 minutes' WHERE id=item;
 UPDATE billing_notification_outbox SET status='sent' WHERE id=item AND claim_worker_id='worker-b' AND claim_expires_at>now();
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'Wrong worker accepted'; END IF;
 UPDATE billing_notification_outbox SET status='sent' WHERE id=item AND claim_worker_id='worker-a' AND claim_expires_at>now();
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'Correct worker rejected'; END IF;
 UPDATE billing_notification_outbox SET status='pending',claim_expires_at=now()-interval '1 second' WHERE id=item;
 UPDATE billing_notification_outbox SET status='sent' WHERE id=item AND claim_worker_id='worker-a' AND claim_expires_at>now();
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>0 THEN RAISE EXCEPTION 'Expired claim accepted'; END IF;
 RAISE NOTICE 'Billing ownership SQL checks passed';
END $$;
ROLLBACK;
