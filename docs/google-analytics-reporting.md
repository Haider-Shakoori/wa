# RelayWA GA4 reporting integration (cPanel API, not VPS)

_Status: client-side GA4 tracking works; the RelayWA platform-admin reporting endpoint is **not yet configured**. This file is a safe setup guide, not a credential, completed-access claim or instruction to commit any key._

## What already works

- RelayWA's public marketing pages conditionally load `gtag.js` for measurement ID `G-61Z26DFM1V`.
- The attached Google Analytics 4 property is `558119248` (RelayWA).
- GA4 contained `page_view`, `session_start`, `trial_cta_click` and `docs_cta_click` data for 2026-10-11.
- Web tracking follows a regional analytics policy and explicitly recorded user preferences. It is not the same authorization as the admin reporting API.

## What is missing

The private NestJS reporting service `apps/api/src/platform/google-analytics-reporting.service.ts` checks for one of the following runtime variables:

```text
GA4_SERVICE_ACCOUNT_FILE=/home/relaywa/.relaywa-private/ga4-service-account.json
# or:
GOOGLE_APPLICATION_CREDENTIALS=/home/relaywa/.relaywa-private/ga4-service-account.json
```

**This path is an example only; there is no key file in the repository.** The backend validates that the credentials belong to the exact service-account email:

```text
relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com
```

Therefore do not generate a different service-account identity without also reviewing the allowlist and security tests.

## Setup procedure (requires explicit Google Cloud and GA4 account access)

1. Authenticate the **local computer** with Google Cloud CLI using your approved Google account: `gcloud auth login`. Identify/select the intended Google Cloud project. The project ID implied by the expected service-account email is `relaywa-analytics`; verify it exists and belongs to your organization before making changes.
2. In Google Cloud Console, verify the expected service account exists, is enabled and the **Google Analytics Data API** is enabled in its project. Use the least-privilege identity and review any provider quotas or billing prompts **before accepting costs**.
3. In **Google Analytics → Admin → Property Access Management** for property **558119248**, add the exact service-account email above with **Viewer** access. Project IAM roles alone do **not** grant GA4 property access.
4. The existing NestJS implementation reads a JSON service-account private key and signs OAuth JWTs. Prefer a keyless auth mechanism when code and cPanel constraints allow. If the existing implementation must be used, create a restricted service-account JSON key via Google Cloud's approved credential flow. **Never paste its contents into ChatGPT, shell logs, GitHub, ticket systems, `public_html`, or frontend assets.** Do not check in generated files.
5. Transfer the file over a private secure channel to `/home/relaywa/.relaywa-private/ga4-service-account.json` on **cPanel**, ownership `relaywa`, `chmod 600`; private directory mode `0700`. Do not put the file in a Docker container on the VPS.
6. Set only the **private cPanel NestJS API** environment variable `GA4_SERVICE_ACCOUNT_FILE` to its absolute path. The production API loads the owner-only file `/home/relaywa/.relaywa-private/api-production.env` via Passenger `app.js`. Persist this setting in the owner's approved private source configuration so regeneration of `api-production.env` does not silently discard it. Do **not** place the key or the path in `NEXT_PUBLIC_*` variables.
7. Restart **only the cPanel NestJS Passenger app** once the environment file exists and service-account property access has propagated. This is not a reason to restart PostgreSQL, Redis, Baileys or any VPS service.
8. Log in as an authorized RelayWA platform administrator; request `GET /api/platform/google-analytics?days=7`. Expect `status: ready` with summaries/trends, and check 30/90 days and 2-minute caching. The route is protected by JWT + PlatformAdminGuard. Never bypass the guard or leak reports to a public route.
9. Confirm outbound HTTPS access to `oauth2.googleapis.com` and `analyticsdata.googleapis.com`. If an API error persists, review service-account Viewer access, exact email identity, file permissions, expected property, and outbound networking **without printing the private key or OAuth bearer token**.

## Operational safeguards

- The GA4 reporting service currently reads a static JSON key. If keys are prohibited in your organization, this integration needs a keyless service-account implementation before activation rather than a workaround that exposes credentials.
- Google Cloud CLI installation does not mean the user is authenticated or the project is configured.
- The GA4 **client measurement ID** is public; the GA4 **private JSON key** is secret. The property numeric ID and service-account email are identifiers, not credentials.
- Never commit `.env*`, `ga4-service-account.json`, `relaywa-ga4-key.json`, `*.p12`, `*service-account-key*.json` or Cloudflare API tokens.
- Do not change consent rules to force analytics collection; maintain privacy controls and the existing lawful region-aware policy.
