# RelayWA cPanel staging deployment

## Deployment boundaries

cPanel 51.81.56.231 (user relaywa): Next.js website, NestJS API, email.
VPS: PostgreSQL, Redis, WhatsApp workers, QR sessions and credentials.
Do not migrate or replace PostgreSQL with MySQL. Do not shut down the VPS.

## Server readiness

SSH authentication to cPanel works. Node.js 22.23.2 and 24.20.0 are installed. CloudLinux Node.js Selector and Passenger are enabled.
Production cutover is blocked until HTTPS for relaywa.com validates, the cPanel website no longer shows Index of /, and DNS propagation settles.

## Build and stage

GitHub Actions workflow 'cPanel staging bundles' creates separate deployable archives plus checksums and a manifest. It packages only the web and API, not the WhatsApp worker or auth credentials.
Build with RELAYWA_API_UPSTREAM=https://api-staging.relaywa.com and NEXT_PUBLIC_API_BASE_URL=/api. The HTTPS API origin is embedded in Next.js at build time. Rebuild for production with the intended production API origin and NEXT_PUBLIC_SITE_URL=https://relaywa.com.
Install into cPanel directories OUTSIDE public_html. Using Setup Node.js App, register two apps running Node.js 22, production mode, each with app.js as its startup file. Read MANIFEST.txt to locate the Next.js standalone app.js.

Suggested staging domains: staging.relaywa.com (Next.js) and api-staging.relaywa.com (NestJS). Confirm these can obtain valid certificates first.

## Private connectivity must be completed before API startup

The NestJS API retains its PostgreSQL DATABASE_URL, REDIS_URL and worker dispatch dependencies. These currently point to resources hosted only on the VPS.
Do not expose PostgreSQL 5432, Redis 6379 or worker 3002 publicly. Configure a secure private network route if supported, or firewall source restrictions plus verified TLS and least-privilege credentials where appropriate.
The worker dispatch service presently listens on 127.0.0.1:3002. A secure TLS gateway or private tunnel is necessary for the cPanel API to reach it. WORKER_DISPATCH_SECRET must remain server-side and agree with the worker.
Preserve existing JWT, webhook encryption, payment and OAuth configuration using the cPanel Node environment configuration. Never upload secrets to GitHub or a public web directory.

## Tests required before cutover

1. Check valid TLS on staging web and API, and GET /api/health through the staging website.
2. Verify login, API keys, sessions, QR, message send/receive, webhooks and media uploads.
3. Verify remote PostgreSQL and Redis connectivity over the approved secure route.
4. Verify Google OAuth redirects, Stripe webhooks, subscriptions and mail notifications.
5. Check CloudLinux resource limits, errors and application restarts.
6. Back up and migrate mailboxes, and verify MX, SPF, DKIM, DMARC and inbound/outbound delivery.
7. Verify DNS and rollback plan. Only then switch production traffic, leaving VPS WhatsApp and PostgreSQL running.
