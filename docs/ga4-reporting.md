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

**Cloudflare Worker (future production integration):** the deployed Worker's environment
must contain an encrypted secret binding named `GA4_SERVICE_ACCOUNT_JSON`. Inside the
existing, authenticated and admin-authorized reporting handler, pass
`env.GA4_SERVICE_ACCOUNT_JSON` to `getGa4AccessToken`. Use the token only server-side to
query the Google Analytics Data API. Do not expose the token or secret to responses,
logs, the browser, or source control.

The NestJS platform-admin guard does not automatically apply to a Cloudflare Worker
route. Keep equivalent authentication and platform-admin authorization in the existing
Worker router. Never publish a standalone unauthenticated reporting endpoint.

The live `/api/health` previously identified `cloudflare-workers` as its runtime,
but the Worker router/source and GitHub-to-Cloudflare deployment workflow are **not
present on this repository's `main` tree**. Therefore this PR cannot be considered a
live Cloudflare deployment fix until the canonical Worker source is located and updated.
Do not deploy or merge on the assumption the NestJS route serves Cloudflare requests.

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
