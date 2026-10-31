# Current-state inventory

Date: 2026-11-01 (Asia/Kabul)  
Scope: PR #216, read-only discovery only  
Repository: [Haider-Shakoori/wa](https://github.com/Haider-Shakoori/wa)  
PR branch: `planning/relaywa-cloudflare-vps-migration-20261101`  
PR head observed: `3e23cd688686b964fc28faa0d4a901ad5287af4f`  
GitHub `main` observed: `692f325a11cf54acb712fbd964917cb66a35623c`

## Safety boundary

No deployment, restart, DNS change, database write, migration, backup overwrite, production-data export, or WhatsApp-session operation was performed. No credentials, tokens, message bodies, or customer data were read or recorded.

## Evidence status

- **Verified** means directly observed through the connected read-only GitHub/VPS/browser surfaces.
- **Historical** means stated by the October 30 plan but not freshly revalidated.
- **Unknown** means the required read-only evidence was not accessible; unknown is not equal to pass.

## Repository and migration source

| Item | Current observation |
|---|---|
| PR state | Open, draft, not merged |
| PR purpose | Documentation-only migration plan and safety gates |
| Main revision | `692f325a11cf54acb712fbd964917cb66a35623c` |
| PR revision | `3e23cd688686b964fc28faa0d4a901ad5287af4f` |
| Cloudflare/VPS plan | `docs/migration/cloudflare-marketing-vps-plan-2026-11.md` |
| PostgreSQL migration chain | `apps/api/migrations/001_*.sql` through `044_*.sql`, with numbered gaps preserved in the repository |
| Deployment-related source | `docker-compose.yml`, `docker-compose.production.yml`, GitHub Actions, `ops/relaywa-edge-worker/`, `ops/seo-overlay/` |
| Backup helper | `scripts/backup.sh`; uses `pg_dump` custom format and optionally archives `.data/wa-auth` |

## October 30 migration artifacts

The PR plan records the following as historical only:

- Target test database: `relaywa_native_test`.
- Historical import: 44/44 tables and 38,547 records.
- Historical examples: 15,648 messages, 3,944 contacts, 16,227 session events, 7 sessions, 4 users, 4 organizations, 4 subscriptions, and 7 API keys.
- Historical reconciliation: zero row-count mismatches and a field/value comparison reported as passing across 44 tables.
- Historical query timings: latest messages 28.03 ms, contacts/session 1.54 ms, subscriptions 0.16 ms.

Fresh verification result:

- Test database identity, connection target, schema, row counts, checksums, and current contents: **UNKNOWN**.
- D1 export snapshot used for the historical import: **UNKNOWN**.
- Encrypted database backups and WhatsApp-auth backups: **UNKNOWN**.
- Reconciliation reports and their source commit: **UNKNOWN**.
- No matching reports or backup artifacts were present in the PR branch tree beyond the historical narrative and backup helper.

The connected VPS MCP rejected filesystem inspection outside its approved roots and has command execution disabled. Therefore no database, backup, or reconciliation asset was opened or modified.

## VPS observation

Connected endpoint:

- Hostname: `businessos-dev-vps`
- MCP identity: restricted `chatgpt` user, no sudo
- Memory: 3,949,576 kB total; 1,994,236 kB available
- Root disk: 63,290,085,376 bytes total; 13,749,456,896 bytes free
- Read-only process inventory showed PostgreSQL, Redis, Caddy/Nginx, Node, PHP-FPM, and Next.js-related processes.
- Docker status was unavailable because the monitoring identity lacks Docker socket permission.
- This host is not proven to be RelayWA production and must not be treated as the migration target.

RelayWA VPS repository path, branch, commit, service revisions, database endpoint, and active-session storage location: **UNKNOWN**.

## Cloudflare/deployed public site

The live public site `https://relaywa.com` was inspected without authentication. The browser showed:

- Public marketing pages and blog routes render.
- After explicit analytics opt-in, the deployed homepage and several blog routes loaded GA4 `gtag.js` with measurement ID `G-61Z26DFM1V`.
- The deployed intent routes `/whatsapp-api-qr-code`, `/whatsapp-webhooks`, and `/guides/whatsapp-web-vs-cloud-api` did not load the GA4 script, despite those routes being present in GitHub `main`’s public-page registry.
- `/dashboard` did not load GA4.
- No Cloudflare RUM script or `/cdn-cgi/rum` element was observed in the DOM. Request-level interception was unavailable in the browser surface, so beacon delivery is not claimed.
- The deployed build’s Cloudflare Pages/Workers deployment ID, project name, environment bindings, build command, and deployed Git revision are **UNKNOWN**.

## GitHub-to-deployed comparison

GitHub `main` contains:

- Next.js web application and shared public-page registry.
- Cloudflare/edge-related workflows and operational scripts.
- PostgreSQL migration chain and Docker compose definitions.
- GA4 consent-aware implementation.

Observed drift:

- Live route behavior is behind or otherwise different from current GitHub public-page registry behavior for the three intent routes above.
- Exact deployed revision and whether the difference comes from stale deployment, alternate project, overlay, or Cloudflare configuration are **UNKNOWN**.
- No Cloudflare account/deployment API evidence was available in this read-only session.

## Required next evidence

Before any staging migration work:

1. Obtain the Cloudflare project/deployment metadata and exact deployed revision through an authorized read-only Cloudflare connection.
2. Identify the actual RelayWA VPS and obtain its repository path, branch, commit, service/container revisions, and database metadata using read-only access.
3. Locate `relaywa_native_test`, its backup set, D1 export, and reconciliation reports; verify identity, schema, counts, checksums, and report source commit without rewriting the database.
4. Re-run application and migration checks only against isolated staging/test resources.
