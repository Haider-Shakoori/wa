# Worker 02 bot test-dispatch gate

Status: development-only, not deployed. No live WhatsApp transport is connected.

1. Keep the existing relaywa-worker-02 standby container unchanged. Its
   standby.mjs heartbeat is not a message-processing worker.
2. Select a *new*, explicitly authorized test session and test recipient.
   Do not use existing customer sessions or their auth directories.
3. Run the isolated runtime and injected mock transport in a separate test
   process. The dispatch gate defaults to dry-run and requires exact session,
   recipient and confirmation-token matches.
4. The held database outbox is never polled or sent by this module.
5. A production transport, durable dispatch claims, session ownership checks,
   delivery acknowledgement, restart-safe idempotency, opt-in activation and
   rollback tests are still required before any real WhatsApp send.
6. Never modify the running worker-02 container or production worker to
   enable this experimental module without a dedicated test session and
   approved deployment procedure.
