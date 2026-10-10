# RelayWA SEO Batch 03 — Analytics & measurable acquisition
**Issue:** https://github.com/Haider-Shakoori/wa/issues/80
**Scope:** first-party verified conversion aggregates, opt-in GA4 public marketing events, organic acquisition segmentation and GSC/Bing setup steps.
**Status:** implementation on feature branch; CI and merge required. No production verification performed.

## What changed
1. `GoogleAnalytics` loads Google's script **only after opt-in** on approved public marketing routes. Consent choice is stored under `relaywa_analytics_consent` in the browser and may be changed via the public footer's "Analytics preferences" control. No pageview is recorded without consent, private routes are excluded, and Google pageview auto-sending is disabled.
2. `safeMarketingPageLocation` only retains a limited five-key allowlist of strictly formatted `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`. It strips all nonapproved parameters such as OAuth callbacks, passwords, tokens, IDs, email query strings and arbitrary referrer data. GA4 event payloads contain only path, CTA placement and validated plan code (never a phone number, email, token, user ID, workspace path or message content).
3. Events: `pricing_view` on the standalone public pricing page, `trial_cta_click` on public trial CTA links, `plan_select` on public plan cards, and `docs_cta_click` on selected public documentation links. Events track **interest**, not successful registrations or completed payment. They are emitted only on opt-in public pages.
4. Platform Admin's existing GA4 Data API report adds `conversionEvents`, `organicCountries` and `organicLandingPages` (GA4 default channel group = Organic Search) while preserving existing total traffic reports. Missing integration credentials produce `not_configured`; no fabricated GA results.
5. Platform-only `GET /api/platform/seo-conversions?days=7|30|90` reports **verified all-acquisition** database counts: newly created workspaces, first-time paying workspaces, and all paid transactions (excluding demo payments). Admin guard remains in effect, and the report contains no individual customer records or PII.
6. Admin dashboard labels GA marketing clicks and first-party paid aggregate counts separately. **The paid numbers are not attributable to organic search yet**. The system does not claim a conversion rate from Google clicks to paid sales without a verified, privacy-reviewed join.

## Events and definitions
| Event or metric | What it means | Source | Constraints |
|---|---|---|---|
| `pricing_view` | Opted-in standalone pricing page load | GA4 client | Only one per page location |
| `trial_cta_click` | Click towards registration/trial | GA4 client | Click is NOT account created |
| `plan_select` | Click on marketing plan | GA4 client | May abandon before payment |
| `docs_cta_click` | Documentation link click | GA4 client | Not an integration completion |
| Organic Search countries | GA4 organic sessions grouped by country | GA4 Data API | Subject to consent and channel classification |
| Organic Search landing pages | GA4 organic sessions grouped by landing page | GA4 Data API | Not keyword-level GSC performance |
| New workspaces | New `organizations` DB rows in period | First-party platform admin | All sources; some may be admin-created |
| First-time paying workspaces | Organizations whose earliest real paid transaction occurred in period | First-party payments DB | All sources; excludes demo payments |
| Paid transactions | Successful real payments in period including renewal | First-party payments DB | All sources, not a unique-customer count |

## Required setup after deployment
1. Ensure GA4 measurement ID `G-61Z26DFM1V` is still correct. In GA4, use **Admin > Data streams** and verify that Enhanced Measurement automatic pageview is not double-counting against RelayWA's explicit pageviews (client uses `send_page_view: false`).
2. On RelayWA public pages, choose **Allow analytics** to confirm consent, then use GA4 Realtime/DebugView to verify `page_view`, `pricing_view`, `trial_cta_click` and `plan_select`; ensure **Decline** sends nothing to GA4.
3. In platform Google Analytics, ensure the configured service account has read-only Viewer access to property `558119248`, and `GA4_SERVICE_ACCOUNT_FILE` points to a credential file mounted securely in the API server. Never commit JSON keys.
4. Verify Google Search Console domain ownership for `relaywa.com`; submit published `https://relaywa.com/sitemap.xml`, check indexing and Performance country/page/search-query reports over settled 28- and 90-day windows. Bing Webmaster Tools: verify property and submit the sitemap there as well. GSC Wizard connected account was subscription-blocked at last check; direct GSC remains an alternative.
5. Capture baseline **only after access is verified**: GA organic sessions by country, high-interest events, GSC nonbranded queries/impressions/clicks/CTR/position, Bing search metrics, and all-source verified paid summary. Leave unobserved metrics as `not available` rather than `0`.
6. Validate Google consent, first-party analytics practices, disclosure text, and privacy policy for each intended jurisdiction with appropriate legal review. The button is an opt-in choice for GA4 only; RelayWA's existing server request analytics are separate and require their own privacy disclosure/retention review.

## Remaining attribution engineering (not silently claimed done)
- Authenticated signup, Google/GitHub signups and Stripe completed/renewal payments are **real events server-side**, but their source and country are not yet safely bound to an anonymous marketing session. We deliberately do **not** send identifiers or tokens to GA4 or claim that these totals represent SEO-paid conversions.
- True organic-to-paid attribution requires explicit privacy-reviewed first-touch/referrer and consent design, server-side evidence of signup/trial/payment, idempotency for Stripe webhooks, verified joins without exporting PII, and opt-out/retention controls. This requires a distinct follow-up milestone and should not be inferred from CTA counts.
- Keyword-level organic discovery belongs to Google Search Console and Bing, not GA4 reports.

## Tests
- `apps/web/test/seo-marketing-analytics.test.mjs` validates approved-path gating, safe UTM filtering, prevented unsafe fields, consent-only GA loading and segregated true sales metrics.
- `apps/web/test/google-analytics.test.mjs` updated to reflect opt-in and campaign-safe `page_location`.
- Run GitHub CI: TypeScript, all tests, production build, dependency audit, Docker Compose checks.
- Production smoke and Search Console/Bing verification require an actual deployment and credential access; none are represented as completed by green CI.
