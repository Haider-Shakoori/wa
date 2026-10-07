-- Stop old queue workers before applying this migration. Do not replay legacy jobs.
UPDATE whatsapp_messages
SET status='failed',failed_at=now(),updated_at=now(),bull_job_id=NULL,
    last_error=CASE WHEN status='claimed'
      THEN 'Legacy queued send interrupted during direct-dispatch upgrade; delivery outcome may be unknown. Check before retrying.'
      ELSE 'Legacy queue retired. Resubmit from the calling application if still needed.' END
WHERE direction='outbound' AND status IN ('queued','scheduled','retrying','claimed');
UPDATE whatsapp_sessions SET messaging_paused_until=NULL,messaging_pause_reason=NULL;
