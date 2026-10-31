# RelayWA Cloudflare marketing + VPS application migration

Status: **planning / read-only discovery**. No production cutover authorized.

## Target architecture (provisional)
- Cloudflare: `relaywa.com` public marketing, pricing, docs, blog and SEO, with working Cloudflare Web Analytics and consent-aware GA4.
- VPS: authenticated application/dashboard (proposed `app.relaywa.com`), API (existing `api.relaywa.com` unless compatibility assessment approves changes), billing/webhooks, queues and WhatsApp engine.
- PostgreSQL on VPS after verified D1 export, transformation, reconciliation and application tests.
- Preserve current live DNS, routes, Stripe webhook endpoints, customer sessions, subscriptions and messaging until explicit cutover approval.

## Mandatory discovery gates
1. Record GitHub main SHA, deployed Cloudflare Pages/Workers deployment IDs, branches, build commands, environment bindings, domains and actual running VPS service revisions. Identify drift; never overwrite newer deployed changes.
2. Inventory every public Next.js route, server-only route, Cloudflare Worker and D1 binding, API dependency, login/session cookie and redirect, webhook, Stripe event, background worker and messaging-session storage location.
3. Capture sanitized production baselines: request counts by hostname/path, Cloudflare Web Analytics beacon configuration, GA4 consent behavior, API errors, resource usage, database schema/counts and backup inventory. Do not collect secrets or customer message contents.
4. Verify which VPS hosts RelayWA. The connected BusinessOS development VPS is not automatically the RelayWA production VPS.
5. Confirm target hosting method for Next.js marketing site (static/Pages or Workers) based on actual route and server dependency inventory. Avoid promising static export until compatibility is verified.

## Implementation gates (staging only)
6. Build Cloudflare marketing-only deployment in a staging environment. Verify pages, metadata, canonical, sitemap, robots, consent, analytics and link destinations. Do not introduce a duplicate Cloudflare beacon.
7. Provision isolated VPS staging services, database, migrations, health checks and secret injection; no production restart or session modifications.
8. Export D1 with consistent snapshot; field-by-field compare PostgreSQL conversions including JSON, timestamps, arrays, IDs, foreign keys, row counts and checksums. Keep source intact. Define incremental delta and final freeze strategy.
9. Run application-level login, dashboard, subscriptions, Stripe webhook signature/idempotency, API, queue, WhatsApp session persistence and rollback tests. Never send real messages as part of tests.
10. Validate TLS, CORS, CSRF, cookies, cross-subdomain auth, API SDK compatibility, webhook URL compatibility and DNS propagation strategy.
11. Run repeatable smoke, typecheck, tests and production-compose validation; record performance/capacity and error budgets.

## Cutover: explicit user approval required
12. Confirm recent recoverable backups and a timed rollback rehearsal. Approve maintenance/dual-write strategy and acceptable downtime. Freeze writes only with explicit approval.
13. Perform final delta sync, reconcile and switch traffic in small steps; monitor HTTP/GA4/Cloudflare metrics, Stripe, API and sessions. Revert on predefined failures.

## Safety rules
- No changes to production Cloudflare, DNS, VPS, D1, Stripe, API, engine, customer sessions, or billing during discovery.
- Do not delete or overwrite D1 data, restart production services, expose secrets, or assume a migration has completed because a build passed.
- Prefer code review and PRs; no auto-merge or auto-deploy.

## Initial verified facts (2026-11-01)
- Repository `Haider-Shakoori/wa` uses `pnpm@12.9.1` and Node >=22.
- Root scripts include `build`, `typecheck`, `test`, `smoke`, `load:smoke`, `canary:prod`, `validate:prod-compose`.
- Current GitHub analytics code uses GA4 `G-61Z26DFM1V` and a shared public-page registry; reported live production differs on several intent pages.
- Connected BusinessOS *development* VPS has approximately 3.8 GiB RAM and 12.8 GiB free disk; not confirmed to be the RelayWA production host.

## Deliverables before cutover approval
- Inventory and architecture diagram; deployment drift report; staging deployment URLs; data reconciliation report; test matrix; resource/cost estimate; operational runbook; rollback checklist; explicit approval request.

## Prior migration work recovered from October 30 (historical, must revalidate)
- User explicitly required import into PostgreSQL **test database only**: `relaywa_native_test`. No production switch from Cloudflare.
- Earlier execution reported D1 export and backup verification, PostgreSQL import of **44/44 tables, 38,547 records**, and zero row-count mismatches. Examples: 15,648 messages; 3,944 contacts; 16,227 session events; 7 sessions; 4 users; 4 organizations; 4 subscriptions; 7 API keys.
- Earlier full field/value comparison reported pass for all 44 tables, including JSON, timestamps, arrays. Baseline query times: latest messages 28.03ms, contacts/session 1.54ms, subscriptions 0.16ms.
- These results are historical snapshots, **not a fresh verification of the current Cloudflare data or the current VPS environment**. Do not re-import or overwrite the existing test DB until its identity, contents, and backup are checked.
- Previously **unfinished**: current deployed Cloudflare ↔ GitHub ↔ VPS source parity, staging login/dashboard/subscription tests, final delta sync, production cutover.
- New first step: locate and verify the existing D1 export, encrypted backups, `relaywa_native_test` schema/counts, prior reconciliation reports and source commit; compare with current production metadata read-only. Preserve all assets.

## Codex implementation brief (first task, discovery only)
1. Work from this PR branch. Read existing reports/scripts and inspect repository structure. Do not change production or rebuild an existing test DB.
2. Find actual Cloudflare deployed revision and compare it to GitHub main, including analytics public intent routes and current Cloudflare-only changes. Report inaccessible resources as unknown, not equal.
3. Discover the correct RelayWA VPS, existing `relaywa_native_test` database, verified backup paths and prior migration artifacts. Use read-only commands/queries. Never access or print secrets or customer message bodies.
4. Produce `docs/migration/current-state-inventory.md` and `docs/migration/parity-gap-report.md` with evidence, commit IDs, differences, remaining tests and concrete staging-only next steps.
5. Run non-mutating checks only. Stop before schema changes, provisioning, deployment, DNS changes, or live API calls that can send messages.
