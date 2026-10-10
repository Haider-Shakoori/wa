# Evidence register, baseline limits and measurement plan
**Research performed:** 2026-10-10. URLs checked with public search/browser tools and GitHub repository connector where indicated.

## Primary evidence and what it does / does not establish

| Source | Reference | Supports | Does not establish |
|---|---|---|---|
| DataReportal Digital 2026 global overview (published near end of 2025) | https://datareportal.com/reports/digital-2026-global-overview-report | Global digital trends and WhatsApp relevance | Number of businesses buying session-based messaging APIs in any given country |
| DataReportal Digital 2026 Brazil | https://datareportal.com/reports/digital-2026-brazil | Brazil digital population/context; published end 2025 | Verified commercial keyword search volume |
| Meta's 2025 WhatsApp milestone reported by TechCrunch (2025-05-01) | https://techcrunch.com/2025/05/01/whatsapp-now-has-more-than-3-billion-users/ | Meta CEO reported 3B+ monthly WhatsApp users globally in 2025 | Country-specific conversion forecasts, exact 2026 user count |
| Google Search Central multilingual/multi-regional SEO | https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites | Distinct URLs, avoiding automatic redirects, reciprocal alternates strategy | RelayWA indexation or ranking status |
| Google Search Central hreflang codes | https://developers.google.com/search/docs/specialty/international/localized-versions | Valid language-region codes; `es-419` unsupported for Google's `hreflang` | That translated pages currently exist |
| Google people-first content | https://developers.google.com/search/docs/fundamentals/creating-helpful-content | Editorial principles; avoid mass-produced doorway content | Guaranteed SERP placement |
| WhatsApp Business Messaging Policy | https://business.whatsapp.com/policy/preview | Appropriate opt-in/opt-out, restrictions, misleading affiliation cautions | Legal/compliance advice for a particular country or a blanket approval of linked-device automation |
| WasenderAPI home | https://wasenderapi.com/ | Competitor public claims: QR, language snippets, sessions, pricing, documentation | Independently tested pricing, SLA or conversion effectiveness |
| Whapi.Cloud home | https://whapi.cloud/ | Competitor public claims: linked channel/QR, docs, webhooks, localization | Verified throughput, safety, customer satisfaction |
| RelayWA GitHub code (repo only) | https://github.com/Haider-Shakoori/wa | Existence of App Router metadata/robots/sitemap/GA4 and QR session libraries | Correct behavior on live server or GSC indexing |

## Measurement state (not estimated)
| Metric | Status | Obtain via |
|---|---|---|
| Google Search Console country/query clicks, impressions, CTR and position, settled 28/90d | **not measured** | Verified RelayWA domain property, GSC Performance exports |
| Google Search Console indexed/crawled pages | **not measured** | Indexing > Pages, URL Inspection for sampled routes |
| Bing country/query clicks and indexing | **not measured** | Bing Webmaster Tools verified domain |
| GA4 organic sessions, signups and paid conversions | **not measured** | GA4 property event validation + acquisition reports |
| Search volume / keyword difficulty per locale | **not measured** | Google Ads Keyword Planner, GSC long-tail queries, independent keyword research tool; date-stamp and record geography |
| Actual competitor ranking by query/country | **not measured** | Reproducible country/locale-targeted SERP spot checks |
| Real per-country trial and paid conversion | **not measured** | First-party attribution + GA4, respecting consent |

**GSC access note:** Attempted GSC Wizard connected app in earlier preparation; it returned `payment_required` (trial ended or subscription inactive). Therefore no GSC performance baseline was obtainable via that integration. Do **not** present derived values, even zero, for absent data.

## Keyword research protocol for Batch 01 sign-off / Batch 03 baseline
1. For each country/locale in `markets.csv`, collect 28-day and 90-day settled Search Console query/page/country exports if verified; distinguish branded and nonbranded.
2. For each candidate in `keyword-map.csv`, record the locale, intended user intent, average monthly searches (with exact tool/time/region), commercial fit and SERP types. Keep `unknown` if a source is unavailable.
3. Review top 5–10 results manually on locale-aware searches; distinguish official Meta Cloud API, authorized BSPs and linked-device/session products.
4. Check whether a single global page would satisfy a query; do not create country pages without differentiated local content.
5. Rank opportunities using **evidence**, not consumer WhatsApp usage alone: product-fit gate first, then buyer-intent, accessible search volume, competitive difficulty, conversion potential and localization cost.
6. Track per-page visibility and trials monthly; hold low-quality translated drafts outside the sitemap until reviewed.

## GSC and Bing setup prerequisites
- Verify ownership of `relaywa.com` in Google Search Console / Bing Webmaster Tools; retain access at domain level, not merely route-level. Do not commit credentials.
- Submit production-generated `https://relaywa.com/sitemap.xml` after Batch 02 and independently confirm it returns XML and contains only intended public pages.
- Review robots and indexability using URL Inspection; an XML sitemap alone does not guarantee indexing.
- Ensure GA4 has opted-in, privacy-reviewed public conversion events without collecting tenant dashboard or message data.
- Save baseline export snapshots securely (do not put sensitive analytics/customer data in a public Git repository).

## Future research cadence
- Monthly: update query data by locale, conversion evidence, top landing pages, competitor public claims and broken links.
- Quarterly: re-evaluate market prioritization and platform-policy changes; retire low-value duplicate pages.
- Before launching new country pages: native-speaker editorial review, factual product/price/legal review, and QA for search intent.
