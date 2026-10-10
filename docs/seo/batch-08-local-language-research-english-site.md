# Batch 08 — Multilingual search research, English-only RelayWA website

**Owner decision (11 Oct 2026):** Keep **all public RelayWA website pages, navigation, product copy, SEO titles/descriptions, API documentation, and registration flow in English**. Research keyword hypotheses in native/local market languages strictly **outside** the live website. Do **not** create translations, locale redirects, foreign-language snippets, keyword-stuffed metadata, unverified product claims, or copied country pages.

**Issue:** https://github.com/Haider-Shakoori/wa/issues/85  
**Corpus:** [local-language-keyword-hypotheses.csv](local-language-keyword-hypotheses.csv)  
**Existing English demand research:** [english-country-keyword-candidates.csv](english-country-keyword-candidates.csv)

## Key distinction: research ≠ Google rank

Google determines a page's language primarily from the actual visible content, not hidden keyword tags. Google explicitly ignores `<meta name="keywords">` for search ranking. Google Search **may**, in eligible cases, translate the result title/snippet and then provide a machine-translated page for a user searching in another language. This is automatic and is **not** a promise that the original English page will rank for every translated query.

References:
- https://developers.google.com/search/docs/crawling-indexing/special-tags
- https://developers.google.com/search/docs/appearance/translated-results
- https://support.google.com/webmasters/answer/10268906
- https://support.google.com/webmasters/answer/17010961

## Country and research-language matrix

| Country | Languages in Batch 08 research | Site language |
|---|---|---|
| India | Hindi | English |
| Brazil | Portuguese (Brazil) | English |
| Indonesia | Indonesian | English |
| Mexico | Spanish (Mexico) | English |
| Colombia | Spanish (Colombia) | English |
| Nigeria | English, Hausa and Yoruba | English |
| United Arab Emirates | Arabic (UAE) | English |
| Pakistan | Urdu | English |
| Saudi Arabia | Arabic (Saudi Arabia) | English |
| South Africa | English and isiZulu | English |
| Spain | Spanish (Spain) | English |
| Germany | German | English |
| United Kingdom | English (UK) | English |

**Corpus status:** 41 **editorial hypothesis** phrases across 13 markets and 16 country-language combinations. **All local-language wording and idiom require local/native-speaker review**. The draft terms are **not** automatically sourced search queries and must not be represented as validated search demand. In markets with multiple official languages, the matrix is a *first-pass sample*, **not** a comprehensive language-market survey. English-specific research from prior batches remains valid alongside this separate local-language dataset.

### Meaning of the fields

Each CSV row stores a local-language `keyword_hypothesis`, its English `english_meaning`, an intent classification, the most relevant **existing** English URL, and evidence/review fields. All rows explicitly record:
- `query_evidence=not_measured`: no observed Search Console search query asserted.
- `native_language_review=pending` and `local_serp_review=pending`.
- `monthly_search_volume=unknown`, `ranking_difficulty=unknown`, `conversion_data=unknown`.
- `publication_decision=research_only`: does **not** grant permission to change public site content.

Even after a draft local term is validated as genuinely searched, linking it to an existing English page is **research classification**, not a claim that page is suitable to rank for a non-English query. Avoid inserting native-language snippets into English SEO titles just to rank.

## Actual site optimization policy

1. Continue optimizing the **English** `/` page for the actual QR-linked WhatsApp Web session API, `/api-docs` for technical terms, `/pricing` for verified plans/trials, and `/help` for FAQs.
2. Use local-language research to understand topics, purchase concerns, request/response tutorials, and regional user problems; write any approved *improvements* to these pages **in English only**.
3. Do not add a foreign-language keyword block, hidden text, keyword-filled alt text, meta keywords, translated titles/descriptions, inaccurate `hreflang` links, or near-duplicate country pages.
4. Keep English language metadata and existing canonicals; consented public GA4 and private noindex rules must remain intact.
5. Where local-language query intent refers specifically to **Meta's official Cloud API**, ensure RelayWA's unofficial QR-linked session model is clearly described; do not falsely target official-only intent as product feature.
6. If local-language demand is strong but translation remains out of scope, document the missed opportunity and test whether English content attracts a real developer audience. No ranking guarantee.

## Search Console measurement plan

Google Search Console **Performance → Search results** can be filtered by country and query, or compared across countries. For translated Google results, use **Search appearance → Translated results** where the option and data exist. Query language is **not directly equal to the visitor's country**; do not classify everyone in Brazil as a Portuguese-language searcher. Low search impressions do not prove no search demand; anonymous/limited query reporting and absent indexation affect results.

**GSC access blocker during this batch:** The connected GSC Wizard service returned `payment_required` (trial ended or inactive subscription). No RelayWA GSC property or metric could be read through that service. Thus **no real keyword volume, ranking, impressions, click counts or conversion rates were obtained**.

Once GSC data can be exported, save a separate dated normalized CSV with columns `country_iso,query,clicks,impressions`, one row per GSC country-query pair. Country accepts ISO 3166-1 alpha-2/alpha-3 or matching country names, and the analyst must record the actual start/end dates.

Run from the project root:

```sh
node scripts/seo-keyword-research-audit.mjs
node scripts/seo-keyword-research-audit.mjs --gsc=/private/path/gsc-country-query.csv --period=2026-09-01..2026-09-30
```

The first command checks the 41 research rows, all 13 researched market codes, only approved English canonical URLs, English root HTML, no keyword meta stuffing and all candidate fields still marked unmeasured/unreviewed. The optional second command **exact-matches** verified export queries against candidate terms and reports **only aggregated matches** by country with the analyst-supplied dates; it does not import GSC data into the repository, upload private queries or infer paid conversions or general keyword search volume. Never commit the raw Search Console export or any customer data.

**Important:** Google Search Console performance provides the site's own observed impressions/clicks, **not global monthly query volume**. Use properly permissioned Google Ads Keyword Planner or a reputable search-demand provider and native SERP review before estimating volumes/difficulty. Keep real paid conversion attribution separate from mere clicks.

## Engineering release evidence

- [Corpus CSV](local-language-keyword-hypotheses.csv), UTF-8 and research-only.
- [Audit and measured-data matching tool](../../scripts/seo-keyword-research-audit.mjs).
- [Automated checks](../../apps/web/test/seo-multilingual-keyword-research.test.mjs) for multilingual Unicode data integrity, evidence honesty, reviewed English URL mapping, country coverage, absence of publication and optional fake-GSC-fixture exact matching.
- No public Next.js route/metadata/UI, API/Stripe/auth/billing, sitemap, or live language selection changes in this batch. CI + security audit and mobile Lighthouse still serve as regression gates.

## Next editorial decision
Treat the 41 terms as a **discovery backlog**. Before using one to inform English copy, assign a native reviewer, inspect country-specific SERPs, check whether query intent matches *QR-linked session API* rather than official Cloud API, compare available GSC data, and check that the **English user-facing change** improves the existing page without misleading users. A separate country page remains conditional on distinct, reviewed value under Batch 09.
