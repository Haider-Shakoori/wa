# Parity gap report

Date: 2026-11-01 (Asia/Kabul)  
Scope: PR #216 and the October 30 Cloudflare D1-to-PostgreSQL migration  
Status: discovery incomplete; no cutover authorization

## Executive summary

The October 30 migration numbers are historical claims in the PR plan, not a current verification. The existing `relaywa_native_test` database, backups, D1 export, reconciliation reports, and RelayWA production VPS revision could not be inspected through the available read-only surfaces. The connected host is explicitly `businessos-dev-vps`, and it is not proven to host RelayWA production.

The live public site also differs from GitHub `main` on three published intent routes’ GA4 behavior. This is deployment drift or an alternate deployment path until the Cloudflare deployment revision is obtained. No source patch is justified by the current evidence.

## Parity matrix

| Area | GitHub / expected | Deployed or VPS evidence | Gap | Risk |
|---|---|---|---|---|
| Git revision | Main `692f325`; PR `e710ab6` | Cloudflare revision unknown; VPS revision unknown | Cannot establish source parity | High |
| Public intent pages | Registry includes QR, webhooks, and Web-vs-Cloud guide | Pages render but do not load GA4 after consent | Runtime behavior differs | Medium |
| Cloudflare deployment | Workflows/scripts exist in repository | Project, deployment ID, bindings, and environment unknown | Cannot distinguish stale build from config/overlay | High |
| Cloudflare RUM | No duplicate beacon should be added | No RUM script observed; request delivery unverified | Configuration remains unverified | Medium |
| PostgreSQL test DB | Historical target `relaywa_native_test` | Identity and current metadata unavailable | No fresh reconciliation basis | Critical |
| D1 export | Historical export referenced only indirectly | File, timestamp, checksum, and source revision unknown | Snapshot provenance missing | Critical |
| Backups | `scripts/backup.sh` defines PostgreSQL/auth backup behavior | Actual backup files, retention, and restore checks unknown | Recoverability unproven | Critical |
| Reconciliation | Historical 44-table/38,547-row claim | Reports unavailable | Historical result cannot be relied on for current state | Critical |
| VPS | Target must be verified separately from dev host | Only `businessos-dev-vps` observed | Correct host not identified | Critical |
| WhatsApp sessions | Must remain untouched | No session storage inspection performed | Safe by non-action, but inventory incomplete | High |
| Runtime services | Compose and worker sources exist in GitHub | Service revisions/status for RelayWA unknown | Application parity unproven | High |

## Confirmed gaps

1. No fresh proof that `relaywa_native_test` exists, is the intended database, or still contains the historical 44-table dataset.
2. No fresh proof that the D1 export and backups are intact, complete, encrypted where expected, and restorable.
3. No fresh reconciliation report tied to a known D1 snapshot, PostgreSQL database identity, and commit.
4. No proof that the connected VPS is the production RelayWA host.
5. No Cloudflare deployment metadata or exact running revision.
6. No proof of Cloudflare Web Analytics/RUM configuration or request delivery.
7. The live site’s GA4 route behavior is inconsistent with the GitHub registry for three published routes.
8. No staging login, dashboard, subscription, webhook, queue, API, or session-persistence test was run; these remain explicitly unfinished.

## Safe staging-only next steps

1. Obtain read-only Cloudflare deployment metadata: project, environment, deployment ID, branch, commit, build command, bindings, domains, and deployment timestamp.
2. Obtain the actual RelayWA VPS identity and repository/service metadata without restarting anything.
3. Locate the test database and run metadata-only checks: database name/role/host fingerprint, migration table, schema list, per-table row counts, nullability/type summaries, and non-sensitive checksums.
4. Inventory backup filenames, timestamps, sizes, encryption markers, retention, and restore-test evidence without opening secrets or customer content.
5. Locate the D1 export and reconciliation reports; bind each report to an export checksum, PostgreSQL database fingerprint, source commit, and tool version.
6. Reconcile again in an isolated read-only or cloned test context. Do not import, overwrite, freeze writes, or perform a final delta.
7. Compare the exact Cloudflare revision with GitHub and inspect the three intent routes in a staging deployment before changing any code.
8. Run non-messaging staging smoke tests for auth, dashboard, subscriptions, Stripe webhook idempotency, API validation, queues, and session persistence. Do not send real WhatsApp messages.
9. Prepare a rollback rehearsal and explicit approval request before any production cutover discussion.

## Cutover blockers

Do not proceed to production migration or cutover until all of these are resolved:

- Correct production VPS and Cloudflare deployment identified.
- Test database identity and backups verified.
- D1 export provenance and reconciliation reports verified.
- Fresh row/value reconciliation passes with reproducible inputs.
- Staging application and infrastructure tests pass.
- Session, billing, webhook, DNS, and rollback plans are reviewed.
- User explicitly authorizes any production freeze, final delta, traffic change, or service restart.
