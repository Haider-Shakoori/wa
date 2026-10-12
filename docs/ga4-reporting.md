# RelayWA GA4: Google Data API reporting and Cloudflare rollout

Public website tracking and administrative reporting are **separate** features.

- Browser measurement ID: `G-61Z26DFM1V` (subject to regional policy and the visitor's preferences).
- Admin report property ID: `558119248`.
- Admin report identity: `relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com`.
- Admin endpoint: authenticated `GET /api/platform/google-analytics?days=7|30|90`.

## Read-only verification (completed 2026-10-12 UTC)

The GitHub Actions workflow `GA4 Read-only Service Account Verification` successfully authenticated
the GitHub repository secret `GA4_SERVICE_ACCOUNT_JSON` and queried GA4 property `558119248`.
This establishes that the JSON service account, Google OAuth, Google Analytics Data API and
property Viewer access work from GitHub Actions. It **does not** establish that the secret
exists in Cloudflare Workers, or that the deployed Cloudflare Worker has the reporting
handler wired up.

No credentials, OAuth tokens, report contents or private keys are emitted to workflow logs.

## Runtime design

`apps/api/src/platform/ga4-service-account.ts` provides a pure Web Crypto
(`crypto.subtle`) Google service-account JWT/OAuth helper, usable in Node 22+ and
Cloudflare Workers. It has no Node filesystem or `Buffer` dependencies.

**NestJS / VPS:** the existing `GoogleAnalyticsReportingService` supports either:

1. `GA4_SERVICE_ACCOUNT_JSON`: entire service-account JSON provided to the **server only**
   through a secret environment variable (takes precedence), or
2. `GA4_SERVICE_ACCOUNT_FILE` / `GOOGLE_APPLICATION_CREDENTIALS`: a path to a
   restricted JSON credential file, retained for old Docker/VPS deployments.

This NestJS class still uses Node filesystem imports for the fallback and is **not** an
entire Cloudflare Worker entrypoint.

**Live Cloudflare routing verified through authenticated read-only API calls:**

| Domain | Deployed Worker |
|---|---|
| `relaywa.com` | `relaywa-web` |
| `api.relaywa.com` | `relaywa-api` |
| `platform.relaywa.com` | `relaywa-platform` |

The deployed `relaywa-platform` entrypoint contains an **existing** async
`googleAnalytics(env, url)` handler returning `status: not_configured`
without calling the Google Analytics API. Cloudflare secret-binding metadata
confirms `GA4_SERVICE_ACCOUNT_JSON` is not listed on any of the three Workers.

**Cloudflare implementation in this branch:**

- `cloudflare/ga4-reporting.mjs` implements real GA4 Data API reports and
  Realtime reporting using Web Crypto, JSON private-key binding, readonly OAuth
  scope, bounded timeouts and two-minute report caching. It preserves the
  existing report response format and 7/30/90-day filters.
- `scripts/ga4/patch-platform-worker.mjs` locates exactly one existing
  placeholder and replaces only that handler, leaving all other routes,
  authentication and role checks untouched. It refuses unexpected or
  already-patched source to prevent accidental overwrites.
- `.github/workflows/ga4-worker-preflight.yml` reads the *deployed*
  `relaywa-platform` entrypoint via **Cloudflare GET**, generates a patched
  candidate **in temporary GitHub Actions files only**, runs Node syntax checks
  and tests, and deletes the files. It does **not** upload or deploy the patch,
  and never prints the original Worker bundle.
- This repository's `main` still does not contain the canonical independent
  Cloudflare Worker source/deployment configuration. The prepared patcher is
  intentionally against the exact live deployed handler, with automatic
  failsafes when the deployed handler changes.

The Next.js/NestJS code is not identical to the currently deployed Worker bundle.
The GA4 reporting endpoint must stay behind the existing platform-admin
authentication and authorization. The patcher preserves the deployed route
table and only changes the pre-existing placeholder's body.

**Production rollout (NOT PERFORMED by this PR):**

1. Get explicit approval and ensure the other agent/deployer has stopped
   changing this production Worker.
2. Back up the existing production script, module parts, metadata and
   currently deployed version without publishing them to the public repo.
3. Bind `GA4_SERVICE_ACCOUNT_JSON` as an encrypted **secret on
   `relaywa-platform`** (not on `relaywa-web`). GitHub repository secrets do
   not automatically propagate to this Worker.
4. Re-fetch the current Worker; refuse deployment if the route/source format
   differs from the tested placeholder. Apply the additive patch while
   preserving all original modules and non-GA4 bindings.
5. Deploy using an approved, audited method, then recheck platform RBAC and
   the authenticated analytics report; roll back if verification fails.
6. Separately verify browser-side measurement ID `G-61Z26DFM1V` and visitor
   consent policy. Restoring platform-admin report reads does not prove
   GA4 browser events are firing.

## Secrets and deployment safety

- The GitHub Actions repository secret `GA4_SERVICE_ACCOUNT_JSON` is **not propagated
  to Cloudflare automatically**.
- Provision the same JSON as a **Cloudflare Worker encrypted secret binding** through
  the audited deployment workflow, or in the Cloudflare dashboard. Doing so is a
  separate, production-changing action and requires explicit approval.
- Confirm the target account, Worker script, environments and route in **read-only**
  Cloudflare API calls before any provisioning. Never guess the Worker name.
- Never print the JSON; don't base64-embed it in a Wrangler config or put it in
  `.env.example`, `wrangler.toml`, Git commits, build artifacts, or `NEXT_PUBLIC_*`.
- Only call `oauth2.googleapis.com` and `analyticsdata.googleapis.com` over HTTPS,
  using read-only Analytics OAuth scope and restricted property access.

## Verification after a later approved Worker deployment

1. Sign in as a platform administrator and select `Platform Admin > Google Analytics`.
2. Confirm `GET /api/platform/google-analytics?days=7` returns `status: ready`
   without exposing secrets, while unauthenticated calls remain unauthorized.
3. Test both real GA4 reports and Realtime against property `558119248`.
4. Separately test browser tracking to `G-61Z26DFM1V`; a working report API
   **does not** prove browser-side page views are being collected.
5. Keep consent and regional privacy behavior; do not bypass users' explicit refusal.

`status: not_configured` means the reporting runtime lacks the JSON/file configuration;
`status: error` means the credential cannot be read or the Google request failed.
The reporting service restricts report windows to 7/30/90 days, caches for two minutes
and preserves existing admin protections in its NestJS implementation.
