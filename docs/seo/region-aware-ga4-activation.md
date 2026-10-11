# RelayWA: region-aware Google Analytics (opt-out protection)

## Launch state: deliberately OFF without reviewed jurisdictions

This feature supports regional automatic GA4 measurement but **does not assume any
country permits GA4 without consent**. The three server-only settings below
are **empty by default**, so *everyone* sees the existing optional
Allow/Decline prompt and no Google tag loads beforehand. Before enabling a
country, obtain a documented legal/privacy assessment for the actual GA4
cookies, users, data sharing, purposes, age restrictions, transfers and
applicable local rules. An example country code in a test or .env comment is
NOT a legal conclusion.

Important primary references:
- Google consent mode basic: https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic
- UK ICO statistical purposes exception (narrow, and *not* permission for
  unrestricted third-party GA4): https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/
- EDPB caution on analytics: https://www.edpb.europa.eu/system/files/2021-03/edpb_statement_032021_eprivacy_regulation_en_0.pdf

## Secure country-policy decision

Browser first-party `GET /analytics-policy` returns only `{"policy":"auto"}`
or `{"policy":"consent"}`, with private no-store, noindex and no country
leak. It is served by Next.js Web, **not** the separate `/api/` backend.

Only returns **auto** if ALL these hold:
1. `GA4_REGION_GEO_HEADER` is set to one of `cf-ipcountry`,
   `x-vercel-ip-country`, `x-geoip-country`.
2. Trusted ingress supplies a valid two-letter country in that header,
   derived from verified edge IP geolocation **not from client input**.
3. Trusted ingress **overwrites and strips** the incoming client-supplied
   `x-relaywa-geo-attestation` header and injects the exact private
   `GA4_REGION_PROXY_SECRET` (32+ random characters).
4. Visitor country is explicitly included in comma-separated
   `GA4_AUTO_APPROVED_COUNTRIES` following review.

**Never accept the country from a query parameter, Accept-Language, browser
navigator, spoofable country header, IP geolocation by browser JavaScript or
untrusted proxy chain.** Nginx on a generic VPS does not necessarily have
geo-country information; a real upstream trusted edge/CDN GeoIP
configuration is required. Do NOT turn on the three settings until the
operator has verified the edge actually overwrites both headers. Prefer a
private, inaccessible direct web origin so clients cannot bypass the ingress.

A malicious request without the secret fails closed; no configured secret,
unrecognized country, invalid code, missing/invalid policy endpoint,
network failure, or timeout requires explicit consent.

## Visitor behavior

- Pending policy check: do **not** load Google; do not flash a prompt.
- Approved region, no stored preference: automatically start GA4 on approved
  **public-only** pages after policy validation. This automatic decision is
  **not** written as an explicit opt-in.
- Other/unknown region: ask visitor Allow or Decline first, using basic
  Consent Mode v2. No GA scripts/pings before consent.
- Explicit stored Allow or Decline overrides region policy, including travel
  between regions. Existing declined visitors must never be auto-reenabled.
- Footer **Analytics preferences** pauses Google and opens the prompt even in
  automatic regions; Decline immediately suppresses further GA activity and
  persists across reloads. Existing Google cookies may remain in the browser
  after withdrawal; the app does not send new GA hits.
- Google ad consent fields always remain denied, for all regions.
- Continue server-side approximate first-party page request metrics,
  separately governed by appropriate privacy notices/legal bases. Country is
  only an eligibility signal, not an identity or evidence of legal status.

## QA: must be satisfied before enabling

1. Run GitHub CI, production build, mobile Lighthouse and browser QA.
2. API route GET default reports `consent` (no country approval).
3. Verify forged `cf-ipcountry` and/or `x-relaywa-geo-attestation` headers
   **cannot** trigger auto unless they are replaced with genuine edge-provided
   values. Audit *both* edge and Nginx header forwarding behavior, including
   direct-origin bypass.
4. Test one deliberately configured reviewed country in staging, an unknown
   country, and a country that requires consent (especially EU/EEA, UK, CH).
5. In a controlled browser, confirm zero Google requests before Allow in the
   consent region; in a reviewed automatic region confirm the GA4 tag / 
   `/g/collect` request, and test footer Decline + reload.
6. Confirm checkout, auth, dashboard, messaging, sessions, personal data,
   private URLs, Stripe and worker are never measured.
7. Confirm the intended GA4 measurement ID `G-61Z26DFM1V` and native GA4
   Realtime still work, and use first-party metrics separately.
8. Keep rollback to existing basic-consent website image; do not change
   Stripe billing or server credentials in the same change.

## Release activation checklist (not automated in GitHub)

- Written jurisdiction-specific permission/assessment with dated reviewer and
  list of country codes; do not broadly approve every non-EEA country.
- DNS/hosting edge supplies attested country signals on *every* request to
  `/analytics-policy` including after SPA navigation.
- Runtime web environment receives the three variables; the `GA4_REGION_PROXY_SECRET`
  matches a long random ingress-only secret. Never use `NEXT_PUBLIC_` or
  store either value in GitHub.
- Update privacy/analytics notice for any regional automatic collection.
- Observe logs/QA after web-only deploy; return to empty country list if
  regional classification is uncertain. Consent remains the safe fallback.

**Safety:** Simply merging this PR does not automatically activate any
jurisdiction. This is intentional: the request was to enable automatic
measurement only where it is *legally permitted*, not to infer permission
from a list of countries.
