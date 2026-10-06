# relayWA Production Runbook

## Bootstrap

1. Configure production environment values.
2. Start PostgreSQL and Redis.
3. Run `pnpm --filter @wa/api bootstrap`.
4. Start API, web and worker processes.
5. Run `SMOKE_BASE_URL=https://your-domain.example pnpm smoke`.

## Required production secrets

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET` (32+ characters)
- `WEBHOOK_ENCRYPTION_KEY` (base64, exactly 32 decoded bytes)
- `RELAYWA_ADMIN_EMAIL`
- `RELAYWA_ADMIN_PASSWORD` (12+ characters)

Stripe variables are additionally required before enabling Stripe.

## Backup

Run `scripts/backup.sh` with `DATABASE_URL` and the same `WA_AUTH_DIR` used by the worker. Back up both the PostgreSQL dump and WhatsApp auth archive together.

## Restore

Set `DB_BACKUP` and optionally `AUTH_BACKUP`, then run `scripts/restore.sh`.

## Recovery check

After restore:
- start API and worker,
- confirm worker leases are acquired,
- confirm sessions recover or request a QR when credentials are invalid,
- run the smoke test,
- verify one test outbound message and one webhook delivery.

## Load smoke

Use `LOAD_BASE_URL=https://your-domain.example pnpm load:smoke`. This is intentionally a lightweight health-path regression, not a substitute for production capacity testing with real WhatsApp sessions.
