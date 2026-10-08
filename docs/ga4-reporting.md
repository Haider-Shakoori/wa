# RelayWA Google Analytics 4 platform reporting

GA4 property **558119248** is configured in the API reporting module. Public website tracking uses Measurement ID **G-61Z26DFM1V** and is a separate feature.

## Prerequisites

1. Google Analytics Data API is enabled in the RelayWA Analytics Google Cloud project.
2. The service account `relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com` has **Viewer** permissions on GA4 property 558119248.
3. Provide a **server-only** service-account credential JSON to the Nest API service. This is a secret; do not paste it in chat, store it in Git, or expose it in Next.js or the browser.

For servers outside Google Cloud, a narrowly scoped service-account JSON credential file can be used if your Google Cloud organization allows key creation. Prefer keyless workload identity federation when configured. To provision the file, download it from Google Cloud > IAM & Admin > Service Accounts > relaywa-analytics > Keys > Add key > Create new key > JSON. Treat it as a password. If key creation is disabled, use a supported Google workload-identity solution instead of weakening organization policy.

## Deploy configuration

- On your VPS, store the file outside the Git checkout and outside any public web directory, with permissions restricted to the API service.
- Bind-mount the file **read-only** into the production API container, e.g. a host path mapped to `/run/secrets/relaywa-ga4.json:ro`. Exactly how to do this depends on your VPS Compose configuration.
- Set `GA4_SERVICE_ACCOUNT_FILE=/run/secrets/relaywa-ga4.json` in the **API container** environment (or `GOOGLE_APPLICATION_CREDENTIALS` pointing to that file).
- Make sure the API container has outbound TLS access to `oauth2.googleapis.com` and `analyticsdata.googleapis.com`.
- Recreate/restart **only the API and web** containers after a green build. No database migration or WhatsApp-worker restart is required.
- Never print credential JSON in logs or share it in a support conversation. Rotate and revoke the key immediately if it is exposed.

## Verification

1. Log in as a RelayWA platform administrator.
2. Go to **Platform Admin > Google Analytics**.
3. Pick a 7, 30, or 90-day period. The API requests Google reports, not synthetic traffic.
4. Verify the response from `GET /api/platform/google-analytics?days=7`: `status: ready` with Google-sourced statistics. `status: not_configured` means the API server lacks the credential file; `status: error` means the credentials, permissions or Google API request failed.
5. Check the public website with GA4 Realtime to verify the browser tag (separate deployment prerequisite). Reports may be empty before tracking is live and do not include historical visits.

The backend limits time-window parameters, caches report responses for 2 minutes, restricts access using existing platform-admin guards, and never sends service-account tokens or keys to browsers.
