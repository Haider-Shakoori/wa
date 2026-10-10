# Batch 05 — English-only international SEO architecture

**Issue:** https://github.com/Haider-Shakoori/wa/issues/82  
**Decision:** RelayWA uses **one English-language website** on **https://relaywa.com**. No translation/localization switch, country/language auto redirects, automatic country URL copies, or non-English pages.  
**Date:** 2026-10-11. **Status:** GitHub implementation only; no production changes until deployment.

## Operational architecture
1. **Single global page per topic.** Current published English routes remain `/`, `/pricing`, `/api-docs` and `/help`. Keep one useful global English page for plans, API documentation and features whenever country-specific needs do not warrant an independently helpful page.
2. **English HTML, canonical and structured data.** Root document uses `<html lang="en">`, pages retain self-canonical URLs, and the homepage's Website/SoftwareApplication JSON-LD describes English content with `inLanguage: "en"`. The indexable page registry controls sitemap entries, GA4 page eligibility, and private-route `noindex`; neither visitor country nor `Accept-Language` changes page selection.
3. **No fake international alternates.** There are no different published language/region versions to connect, so do **not** output `hreflang` links or `x-default`. If substantive parallel *English* versions of the same topic are later intentionally published for different countries, evaluate Google’s same-language regional `hreflang` guidance, their distinct content and canonical relationship before implementation.
4. **13-country research catalog, not 13 URLs.** `apps/web/lib/international-seo.ts` defines the eight original research markets (IN, BR, ID, MX, CO, NG, AE, PK) and five extension candidates (SA, ZA, ES, DE, GB). `proposedEnglishCountryPath()` is a convention, not a Next.js route, and does not make a URL crawlable or indexable.
5. **Future country editorial release gate.** `validateEnglishCountryPublication()` requires approved English metadata, distinct substantial copy, market-specific relevance, HTTPS evidence, a dated human reviewer, verified RelayWA product claims, and a live page check **before** a country page can be approved. Automated word-count checks cannot establish useful originality; editorial review and a real route + live HTTP 200 are still required.
6. **Country-targeted English keyword candidates.** `docs/seo/english-country-keyword-candidates.csv` contains 26 English-language research phrases (two per market), mapped to already published global routes. Search volume, keyword difficulty, trial and paid conversion data remain **unknown**, not fabricated. Future content planners can cross-check GSC country-filtered English search queries and SEO competition.

## Country page release checklist (Batch 09)
1. Demonstrate that an English user in that country needs content distinct from the global page, and confirm measurable local search interest (or label hypothesis).
2. Create useful manually reviewed country content with actual examples relevant to RelayWA’s QR-linked WhatsApp **session API**, *not* Meta’s official Cloud API.
3. Confirm billing/trial availability, product restrictions and any claims about local compliance, partner relationships or hosting with real evidence.
4. Implement the corresponding English route at `/countries/<market-slug>` and verify it returns public server-rendered HTTP 200 with unique title, H1, description and canonical. Never point to a non-existent path.
5. Only **then** add it to `apps/web/lib/public-pages.ts`, which makes it visible in sitemap/analytics. Ensure it has meaningful internal links from related global English pages.
6. Run tests for unique content/metadata, sitemap, private noindex, navigation, analytics opt-in, mobile Lighthouse and relevant paid checkout flows.
7. Do not add all 13 URLs by default. If a country page duplicates the global page, keep the global page and skip the duplicate.
8. Use regional `hreflang` only if there are real alternate country-specific versions of the *same* topic in English, and implement reciprocal annotations with correct self-references and canonical policy.

## Engineering changes and tests
- New `lib/international-seo.ts` research market and editorial gates.
- Homepage JSON-LD `inLanguage` for Website and SoftwareApplication.
- New `seo-english-international.test.mjs` checks country identity, candidate English phrases, draft/unpublished exclusion, no forced language redirects and publication validation.
- `scripts/seo-perf-budget.mjs` now uses the production-built Next server to assert language metadata and **404 + noindex** for proposed-but-unpublished `/countries/india` and `/countries/brazil` and untranslated paths `/pt-br`, `/es` and `/ar`, plus no `Accept-Language` forced homepage redirects.
- Existing tests, TypeScript, Next build, Lighthouse and security checks must remain green.
- No live country page or language folder is added in Batch 05.

## Search Console and rollout
Check search performance by **country**, **page**, and **query**, separating English queries from local-language queries. Query language cannot be inferred reliably merely from country. Site-wide GSC and Bing metrics, confirmed indexation, live HTTP canonicals, organic-to-paid attribution and live deployment remain separate external gates.

## Google reference
- https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls

**Important:** English-only is an editorial and maintenance preference, not proof that searchers in Brazil, Mexico, Indonesia or Saudi Arabia primarily search in English. International demand and search visibility must be validated, and no SEO or conversion improvement is guaranteed.
