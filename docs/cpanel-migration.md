# RelayWA production deployment: cPanel + Cloudflare Free + VPS

_Last reviewed: 2026-10-12. This is a sanitized infrastructure runbook, NOT a secrets backup and NOT a complete operational acceptance sign-off._

## Hard deployment boundary

| Service | Runtime / location | Rule |
| --- | --- | --- |
| Public Next.js web + admin UI | cPanel CloudLinux Passenger / Node.js 22, `/home/relaywa/apps/relaywa-web-production/apps/web` | Host on cPanel |
| NestJS API, including GA4 reporting and login | cPanel CloudLinux Passenger / Node.js 22, `/home/relaywa/apps/relaywa-api-production` | Mount API under `https://relaywa.com/api`; do not place on VPS |
| Public web TLS, caching, HTTP/2/3 | Cloudflare **Free** in front of cPanel | Cloudflare is reverse proxy, not the application host |
| Email (SMTP/IMAP + webmail) | cPanel `51.81.56.231` | DNS-only; preserve MX/SPF/DKIM/DMARC |
| PostgreSQL, Redis, Baileys WhatsApp workers, auth sessions, QR state, queues | Original VPS / existing Docker deployment | **Do not migrate, replace, restart, or remove** |
| Old VPS web/API containers | VPS (temporary rollback/fallback) | Do not retire without verified rollback and explicit approval |

The cPanel host is `51.81.56.231`, user `relaywa`. The historical VPS public IP is `108.165.233.125`; it is **not** a Cloudflare website origin. Never copy live database contents, Redis state, WhatsApp keys/sessions, Stripe/OAuth secrets, service-account JSON, or SSH private keys into Git.

## Cloudflare DNS and SSL — observed configuration

The Cloudflare Free zone `relaywa.com` is **Active**. Assigned authoritative nameservers:

- `audrey.ns.cloudflare.com`
- `mitch.ns.cloudflare.com`

The DNS-only/proxy reference is in [`deploy/cloudflare/zone-config.example.json`](../deploy/cloudflare/zone-config.example.json). The important records are:

- `relaywa.com` A `51.81.56.231`: **Proxied** (orange cloud).
- `www` CNAME `relaywa.com`: **Proxied**.
- `mail` A `51.81.56.231`: **DNS only**. MX `relaywa.com` priority 0 → `mail.relaywa.com`.
- `cpanel`, `cpcontacts`, `cpcalendars`, `ftp`, `webdisk`, `webmail`, `whm`, `staging`, `api-staging`: **DNS only**.
- Preserve the **existing authoritative** SPF, DKIM, DMARC and any other TXT, CAA, SRV and service records; never regenerate or replace them from this example.
- No website DNS A record should target the old VPS. The reverse tunnel is private infrastructure and must not be proxied or given a public DNS endpoint.

**SSL/TLS mode: Full (strict)**. Universal SSL certificate reported **Active** for `relaywa.com` and `*.relaywa.com`. HTTP/2 was independently verified on Cloudflare edges; edges advertise HTTP/3 (`alt-svc: h3`), but a true HTTP/3 client negotiation was **not** verified. `http://relaywa.com` redirects to HTTPS.

Cloudflare edge was seen serving public pages and `/api/health` as HTTP 200, with `cf-cache-status: DYNAMIC` on dynamic routes. Immutable versioned `/_next/static` CSS returned `MISS` then `HIT` from Cloudflare; Brotli worked for HTML. **Do not create Cache Everything rules**: never edge-cache `/api/*`, `/login`, `/register`, dashboards, authenticated responses, Stripe webhooks or personalized HTML. Preserve `Set-Cookie` and all auth headers.

**DNS propagation note:** shortly after nameserver cutover, some resolvers and client machines still resolved `relaywa.com` directly to `51.81.56.231` (HTTP/1.1) while others returned Cloudflare IPs (HTTP/2). This may explain varying Lighthouse scores. Do not require visitors to manually change DNS.

## cPanel deployment and configuration

- The application packages are built by [`cPanel production candidate`](../.github/workflows/cpanel-production-bundles.yml) and [`cPanel staging bundles`](../.github/workflows/cpanel-bundles.yml). Their archives contain **only web and API**, never worker/DB data or keys.
- CloudLinux Node.js Selector/Passenger has separate production app roots for Next.js (`/`) and NestJS (`/api`); each app starts from `app.js` and uses Node.js 22.
- Environment files live outside `public_html` under `/home/relaywa/.relaywa-private/`, owner-only mode `0600`:
  - `web-production.env` for web;
  - `api-production.env` for API.
- The Git-tracked provisioning script [`scripts/provision-cpanel-env.mjs`](../scripts/provision-cpanel-env.mjs) generates sanitized-host-specific private environment files **only on the server** from an owner-only production source file; it never commits their contents. The server's private env must preserve JWT, OAuth, billing, SMTP, encryption and webhook keys.
- Production site URLs: `https://relaywa.com`; public API base path: `/api`; worker dispatch transport on cPanel: `http://127.0.0.1:13002` **only through SSH reverse forwarding**. PostgreSQL uses the tunneled Unix socket `/home/relaywa/.relaywa-staging/private/pg/.s.PGSQL.5432`, not a public DB port. Redis also remains on VPS; verify the application's existing secure Redis transport before declaring the full system accepted.
- The VPS watchdog [`deploy/vps/ensure-cpanel-tunnel.sh`](../deploy/vps/ensure-cpanel-tunnel.sh) monitors the **VPS-initiated** private SSH tunnel, preserving the worker and database. Do not expose Postgres 5432, Redis 6379 or worker 3002 to the internet.
- Apache text compression settings: [`deploy/cpanel/relaywa-compression.htaccess`](../deploy/cpanel/relaywa-compression.htaccess). Append the snippet *after* CloudLinux-managed Passenger directives in cPanel's `public_html/.htaccess`; do not replace the selector-generated configuration.
- A website-only performance release was deployed to cPanel with rollback copy `/home/relaywa/apps/relaywa-web-preperf-d659b074`. **Not every later green GitHub commit is deployed**: compare release SHA and assets before stating production is current or promoting a new build.
- GitHub branch `feat/cpanel-hosting-package` is tracked in **PR #120**. It is intentionally unmerged pending deployment-automation and operational acceptance review. Merging to `main` might trigger legacy VPS deployment; do not merge or stop production VPS services implicitly.

## Google Analytics — two separate integrations

**GA4 web tag (observed receiving data):** `G-61Z26DFM1V` loads on selected public pages after the site's region and analytics-consent policy check. The public `/analytics-policy` endpoint must stay `private, no-store` and must honor consent requirements; do not override recorded visitor refusals. GA4 property ID `558119248` (RelayWA) was independently queried and had page-view data.

**Admin GA4 reports (NOT configured as of this review):** `apps/api/src/platform/google-analytics-reporting.service.ts` requires a server-private `GA4_SERVICE_ACCOUNT_FILE` or `GOOGLE_APPLICATION_CREDENTIALS` JSON file belonging to `relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com`. Grant the service account **Viewer** access to GA4 property `558119248` in GA4 Property Access Management, then securely supply the private JSON path in the cPanel API environment. It belongs on **cPanel**, not in a VPS Docker container and never in GitHub. See [`docs/google-analytics-reporting.md`](google-analytics-reporting.md). No key is embedded in the repo and these docs do not claim the admin reports work.

## Smoke tests and rollback criteria

1. Test `https://relaywa.com/`, `/login`, `/pricing`, `/api/health`, `/api/public/plans` via Cloudflare, confirm TLS and HTTP 200. Unauthenticated private API must still return 401.
2. Confirm Cloudflare `server: cloudflare`, HTTP/2 and `alt-svc: h3`; preserve Cloudflare Free and Full (strict).
3. Verify direct cPanel origin with `curl --resolve relaywa.com:443:51.81.56.231 https://relaywa.com/api/health` so origin is independently available.
4. Verify `mail.relaywa.com` still DNS-only, cPanel IMAP/SMTP reachability, mail authentication TXT, and an actual outbound/inbound test. Merely seeing open ports does **not** prove delivery.
5. Test **authenticated login**, social OAuth, Stripe checkout and webhooks, QR pairing, WhatsApp send/receive/media, and tunnel recovery through approved test accounts **before retiring any VPS web/API fallback**.
6. Monitor cPanel Passenger/resource/log health and DNS propagation. During rollback keep the VPS PostgreSQL, Redis and WhatsApp containers **running**; revert only web/API deployment or Cloudflare website routing when necessary.
