# RelayWA platform operations hardening (PR #72)

**Deployment: paused at the owner's request.** These changes exist only on the draft GitHub branch. Do not pull, merge, migrate, restart or reconfigure the production VPS until specifically authorized.

## Incident lifecycle

- System alerts are not necessarily service failures. The alert's notification status (queued/sent/failed), acknowledgement (reviewed) and resolution (fixed) are independent.
- **Active** incidents default to `resolved_at IS NULL`. Once a real worker session lease is refreshed, previously raised `worker.session_lease_expired` alerts auto-resolve. Others can be resolved or reopened by Super/Support Admins with an audited reason.
- **Diagnostics** shows current error states by default; successful recovery automatically moves previous error rows into the history view.
- A Super/Support Admin may archive a reviewed failure with a required reason. The underlying session/message/webhook record is never deleted. If the record changes later, the archive annotation no longer suppresses it.
- Historical error counts remain available; the main Overview counts only current unresolved failures.

## Worker liveness

- A dedicated worker-process heartbeat is written about every 15 seconds to `relaywa_worker_heartbeats`. An absence older than 90 seconds is **offline**; a missing heartbeat is **unknown** (not automatically "expired").
- Session ownership leases are reported as a **separate** metric and may expire independently of process liveness. Do not interpret a database `connected` label alone as a health check.
- **Important limitation:** if the entire worker fleet stops, the worker cannot send its own offline alert. Configure an external uptime checker or separate watchdog for VPS loss, API health, Redis/PostgreSQL connectivity, and expired worker heartbeats.

## Account client IP capture

- Production Express accepts one trusted reverse-proxy hop by default via `TRUST_PROXY_HOPS=1`. Set `TRUST_PROXY_HOPS=0` for direct/no-proxy deployments. The upstream proxy must overwrite/apply trusted forwarded headers; the API port must not be publicly accessible.
- The recorded IP comes from the login request. Password, registration, Google ID-token and GitHub exchange flows preserve it, including MFA challenges. Historic private proxy IPs cannot be backfilled.
- Login sessions continue to expose device user-agent, IP, creation time and revocation status to the owner.

## Deployment prerequisites

1. Ensure the runtime reverse-proxy topology really has **one trusted hop**; do not deploy with blind trust of arbitrary forwarded headers.
2. Apply `apps/api/migrations/040_worker_diagnostic_lifecycle.sql` *before* restarting the worker or changing the API report to query the new heartbeat and archive tables.
3. Update API + web + worker together for this phase, preserving the existing WhatsApp auth volumes. The previous plan/payment features in the same PR remain draft.
4. Verify existing WhatsApp sessions recover and process heartbeats progress over a full 90-second window. Confirm sessions with expired leases are correctly distinguished from an offline process.
5. Run a normal browser login behind Nginx and confirm the actual public IP is logged, without relying on a spoofable `X-Forwarded-For` header from a direct API connection.
6. Test manual-payment approval and Stripe webhook replays against a staging database before production.
7. Confirm alert email delivery is configured (SMTP and recipients) and deploy **external** worker/VPS outage alerting. In-app monitoring alone cannot notify an operator who isn't logged in.

No existing WhatsApp data, payment records, user login sessions, or incident history are to be deleted as part of this migration.
