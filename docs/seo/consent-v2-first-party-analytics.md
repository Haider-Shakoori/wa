# RelayWA: basic Google Consent Mode v2 and first-party website metrics

## Policy / launch choice

We use **basic** Consent Mode v2: the Google tag does **not load** until a
visitor explicitly chooses **Allow analytics** on a public marketing page.
Decline / no choice = no Google tag request, cookie, or cookieless GA ping.
When the user grants consent, the four Google consent fields are initialized
with a **denied default before the tag loads**, followed by an analytics-only
grant. The advertising fields (`ad_storage`, `ad_user_data`,
`ad_personalization`) remain denied. Neither Consent Mode nor first-party
statistics overrides an explicit refusal.

This is deliberately *not* advanced Consent Mode: advanced mode can transmit
limited cookieless Google pings even when consent is denied. Do not enable
advanced behavior or silent Google collection without a separate privacy/legal
review of the target markets and an affirmative product decision.

Sources:
- Google's basic-vs-advanced overview: https://support.google.com/analytics/answer/14009635
- Google's gtag.js implementation: https://developers.google.com/tag-platform/security/guides/consent
- Google's consent-mode concepts: https://developers.google.com/tag-platform/security/concepts/consent-mode

## GA4 implementation

- Public marketing tag: `apps/web/components/google-analytics.tsx`, measurement
  ID `G-61Z26DFM1V`; consent helper: `apps/web/lib/ga4-consent-v2.ts`.
- Default state: all four v2 consent types denied; tag remains **unloaded**.
- After approval: `analytics_storage: granted`, all three advertising
  permissions denied; queue built BEFORE loading `gtag.js`. Automatic
  `page_view` remains disabled. Send a single manual page view on each
  indexable public URL and a small allowlist of non-identifying CTA events.
- **Private routes excluded** (dashboard, account, checkout, etc.). Google
  receives neither WhatsApp message content nor account/session identifiers.
- After decline/revocation: use `gtag('consent','update', ...denied)`,
  `ga-disable-G-61Z26DFM1V = true`, suppress further page/event calls. An
  already-loaded JavaScript library cannot be unloaded from browser memory,
  but must not collect more events. Returning denied visitors never load it.
- The Analytics preferences button in the public footer reopens the consent
  choice, allowing immediate withdrawal without signing in.

**Important**: an optional-analytics grant is **not** permission for ads,
remarketing, or personal-data advertising. Advertising permission stays denied.

## Independent first-party analytics

The already-existing `apps/web/proxy.ts` server document-request collector
and Platform Admin > Website traffic report remain separate from GA4:
- Only registered public page document requests, not private app/checkout/API
  URLs, can enter the server-side metrics.
- Requests are grouped by approximate device type, referrer **hostname**,
  page path, crawler class and country **only** where a trusted network country
  signal is provided (else unknown).
- Daily-rotating keyed HMAC of client network address and user-agent estimates
  unique visitors without storing a long-lived identifier. It is NOT proof
  of a unique person or complete anonymization.
- The ingest API receives a client IP transiently for country resolution;
  deployments must assess necessary retention, a legitimate legal basis,
  regional requirements, adequate notices, and deletion/retention settings.
- Administrators may opt out a testing browser via the existing Website traffic
  exclusion control. First-party collection is controlled by the existing
  server-side ingest configuration, not by Google consent state.
- Page requests and GA4 user sessions are different metrics; never add or
  compare them as if they represent the same individuals.

## Verification and deployment

1. GitHub CI should pass TypeScript, service tests and production build.
2. Playwright in `tests/seo-e2e/analytics-consent.spec.cjs` intercepts Google's
   external tag so CI sends no measurement events to the real GA4 property.
   It checks *no tag request* before acceptance or after declining and verifies
   default-v2 denial, update-v2 analytics-only grant, one allowlisted page view
   and revocation. Runs on desktop and mobile Chromium.
3. On authorized staging/live site (after deployment), manually verify
   Tag Assistant and GA4 Realtime for a **consenting test visitor**.
   Pre-consent: no Google tag load. Post-consent: expected G-61Z26DFM1V
   requests and GA4 Realtime. Decline: no tag.
4. GA4 service-account *reporting* for Platform Admin is independent of
   client consent, and requires GA4 Viewer permission for property 558119248.
   Windsor.ai and Search Console ownership are separate integrations.
5. Do not modify live Stripe credentials, session worker, PostgreSQL volumes,
   Google Analytics or Search Console permissions, or DNS as part of this code.

**Operational note:** This improves consent signal handling, **not** the
proportion of visits measurable through GA4. GA4 reports can remain empty
while privacy-first first-party counts are available.
