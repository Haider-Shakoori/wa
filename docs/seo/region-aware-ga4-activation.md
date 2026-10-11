# RelayWA — EEA, UK and Swiss GA4 consent with offline country detection

## Requested visitor behavior

- **EEA (EU 27 + Iceland, Liechtenstein, Norway), UK (GB/UK), Switzerland (CH):**
  keep the existing **Allow analytics / Decline** prompt for first-time visitors.
  No Google tag or cookieless ping before consent.
- **Afghanistan (AF), and other valid, independently verified non-protected
  countries:** automatically send GA4 public-page activity in the background.
  Do not show the popup unless the visitor opens Analytics preferences.
- **Unknown/unverified country, invalid IP, backend unavailable or any failed
  attestation:** keep consent required. Never guess country from UI language.
- **All countries:** honor any previously stored Allow/Decline, offer the
  existing footer preferences control and do not collect GA4 on private pages.
  Advertising consent remains denied.

This is a product-defined routing policy, **not a legal determination** that
all countries outside these three regions permit GA4 tracking. Privacy and
cookie laws in other countries may require further limitations. A privacy
notice and regional legal review remain recommended.

## Architecture — no commercial geolocation API

RelayWA already maintains indexed `website_geoip_ranges` country ranges in
PostgreSQL for its approximate first-party traffic dashboard.

1. Browser makes `GET /analytics-policy` with no country or IP parameters.
2. Next web server checks `GA4_REGION_IP_LOOKUP_ENABLED=true` and verifies
   `x-relaywa-geo-attestation` using the server-only
   `GA4_REGION_PROXY_SECRET` (at least 32 random characters).
3. **Trusted gateway** must always overwrite the attestation header and
   the frontmost proxy MUST replace (not trust) any client-supplied
   `X-Forwarded-For` before Nginx appends its upstream address.
4. The web server validates the first IP in the sanitized chain with Node
   `isIP`. Without a verified ingress attestation and a valid IP, it returns
   `{"policy":"consent"}`.
5. Web server makes a 1.8s-bounded POST to private
   `http://api:3001/api/website-events/resolve-country`, using the existing
   `WEBSITE_ANALYTICS_INGEST_KEY` as an internal authentication token.
6. API validates that token with constant-time comparison, validates IP, and
   looks up the country in the **local** indexed GeoIP table. It doesn't
   store the lookup IP or send it to an external provider.
7. Web server applies the protected country set in
   `apps/web/lib/regional-analytics-policy.ts` and returns **only**
   `{"policy":"auto"}` or `{"policy":"consent"}`, with no-store/noindex.
8. Client Google tag is consent-gated/allowed exactly as in PR #113; client
   never receives raw IP, geo database details or internal credential.

Configuration (runtime only; never commit secrets):

```
GA4_REGION_IP_LOOKUP_ENABLED=false
GA4_REGION_PROXY_SECRET=
WEBSITE_ANALYTICS_API_INTERNAL_URL=http://api:3001
```

The `WEBSITE_ANALYTICS_INGEST_KEY` is already used by the first-party
collector and must be present in both Web and API. The `GA4_REGION_PROXY_SECRET`
must match the value injected **by the trusted Nginx config** into each
request's `X-Relaywa-Geo-Attestation`. Never configure the secret as public
JavaScript, and never trust a user-provided attestation/country header.

**Rollout order matters:** deploy the API country lookup first and confirm
that unauthenticated calls are blocked, then deploy the web image with
policy disabled, update private gateway header sanitization, test that forged
client X-Forwarded-For is discarded, and only then set
`GA4_REGION_IP_LOOKUP_ENABLED=true` and validate AF/EEA/UK/CH/unknown
behavior from known networks. Keep the current web image available for
rollback.

## Security / operations

- No IP-based decision from the browser, cookies, language, UTM parameters,
  `CF-IPCountry` sent by visitors, or public query parameters.
- No client API key and no sensitive country data in browser responses.
- No automatic GA4 in an unknown network: the banner is the safe fallback.
- If `/analytics-policy` fails or times out, the client requires consent.
- Do not overwrite a stored `denied` preference; withdrawal via footer is
  effective on the current page and persists after reload.
- Do not change or restart the WhatsApp worker or Stripe services. API
  resolution is read-only. Existing web-page traffic collection is unchanged.
- Verify the public site, subscription checkout and private routes after
  deployment; review first-party traffic country resolution and GA4 Realtime.
- The post-consent `/g/collect` network check can be intercepted so it does
  not generate synthetic GA4 sessions; a real opted-in visit confirms
  receipt on Google.

## Sources

- EEA definition (EU 27 + Iceland, Liechtenstein, Norway):
  https://employment-social-affairs.ec.europa.eu/policies-and-activities/moving-working-europe/eu-social-security-coordination/frequently-asked-questions/faq-social-security-where-do-these-rules-apply_en
- Google Basic Consent Mode:
  https://support.google.com/analytics/answer/14009635
- Google EEA, UK and Swiss consent signals:
  https://support.google.com/google-ads/answer/16142339
