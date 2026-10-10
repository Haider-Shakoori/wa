# RelayWA international SEO — Batch 01
**Research snapshot:** 2026-10-10  
**Status:** strategy and repository audit; **not** a production crawl, keyword-volume report, deployment, or rankings certification.  
**Issue:** https://github.com/Haider-Shakoori/wa/issues/78

## Batch 09 SERP sample and English pricing clarification — pending country gate (2026-10-11)

- [14-country public search-result samples](batch-09-country-serp-evidence.csv): exact research queries, one representative observed URL each and official/local provider intent observations, **not** a top-ten ranking crawl.
- [Decision, country matrix and five original content briefs](batch-09-serp-intent-and-publishing-gates.md): hold all thin country pages until local buyer/GSC evidence and verified regional differentiators exist; prioritize honest **English** pricing and original technical workflows.
- [Read-only observation audit](../../scripts/seo-country-serp-audit.mjs) and [tests](../../apps/web/test/seo-country-serp-pricing-intent.test.mjs).
- Existing `/pricing` now distinguishes RelayWA's QR-linked session subscription from the **official Meta WhatsApp Business Platform**, links to the actual Meta pricing reference and existing RelayWA session/retry docs. No live plan/pricing data or subscription logic was changed.
- **Batch 09 remains open**: no local GSC data, verified buyer-region need or fully examined localized organic result pages. Zero country pages published, **no foreign-language website content** and no VPS deployment.

## 14-country Ahrefs master keyword report — screenshot evidence (2026-10-11)
The user shared Ahrefs Keyword Generator screenshots for 13 previously studied markets **plus the USA**. An audited [98-record country-keyword master file](whatsapp-api-ahrefs-14-market-master.csv) and [analysis report](whatsapp-api-master-keyword-report.md) now map the exact reported **volume thresholds** and difficulty labels to commercial/developer search intent and **existing English pages only**.

The screenshot-based estimates are **not** exact/global monthly volumes, not rankings, and do not justify auto-generated country pages or foreign-language site copy. Source provenance filenames, missing KD labels and unverified Meta-only intent are preserved. [Reproducible audit](../../scripts/seo-master-keyword-audit.mjs). This is **Batch 09 pre-publication research**, not completion of country landing pages or live deployment.

## Batch 08 decision — multilingual keyword research ONLY (2026-10-11)
The public website and all SEO metadata remain **English only**. However, it is permitted and useful to research *local-language search queries*, their English meanings and intent for every studied market, **without publishing foreign-language pages**. Native-language terms must not be stuffed into metadata or hidden on site to claim rankings.

- [Batch 08 method, measurement gates and GSC access blocker](batch-08-local-language-research-english-site.md)
- [41 local-language keyword hypotheses for 13 countries](local-language-keyword-hypotheses.csv) — all candidates unmeasured and pending native-speaker/SERP validation.
- [Read-only research audit and optional offline GSC query comparison](../../scripts/seo-keyword-research-audit.mjs). The actual Search Console data are not connected/confirmed.
- Existing [English keyword research](english-country-keyword-candidates.csv) remains relevant; neither dataset authorizes publishing duplicate or translated pages.

## Superseding decision — English only (2026-10-11)
RelayWA will remain **English-only** for all thirteen researched markets. The earlier local-language/translation/locale and `hreflang` plans in this **historical Batch 01 research snapshot** are **not implementation requirements**. Do not create translated pages or language selectors. Research language and locale columns remain archived evidence, not selected content direction.

- **Active implementation:** [Batch 05 English-only architecture](batch-05-english-only-architecture.md)
- **Active English keywords:** [26 English candidate phrases for thirteen markets](english-country-keyword-candidates.csv)
- **Later batches:** global English feature/docs first; country-specific English pages only with verified distinct value (Batches 08–09).
- **SEO rules:** single global English canonical per topic; no `hreflang` if no true regional alternates; no auto redirects; preserve private-route protections and opt-in GA4.

## Decision
Position RelayWA as a **developer-focused WhatsApp-linked-session messaging API**: pair an existing number via QR, send and receive supported message types via REST, manage multiple sessions, receive webhooks, and use subscription-controlled workspaces. The implementation currently uses Baileys and Chromium/whatsapp-web.js, **not the official Meta WhatsApp Cloud API**. No promise of official partnership, verified business account, guaranteed deliverability, zero ban risk, unlimited safe messaging, or country-specific regulatory compliance.

## Five-market research extension (October 2026)
- [expansion-five-markets.md](expansion-five-markets.md): research assessment for Saudi Arabia, South Africa, Spain, Germany and the UK; includes source URLs, observed competitors and differentiated launch gates.
- [expansion-markets.csv](expansion-markets.csv): five additional **research-only** countries with internet reach, suggested locales and all API demand/conversion values explicitly unknown.
- [expansion-keywords.csv](expansion-keywords.csv): 25 **unverified** additional local keyword candidates mapped to proposed content, not automatically approved for publishing.
- Wave 1 remains **eight countries**; expansion makes **13 countries in the research matrix**, not 13 country landing pages nor proven commercial markets.

## Deliverables
- [technical-audit.md](technical-audit.md): file-grounded Next.js SEO inventory, missing pieces, and severity.
- [markets.csv](markets.csv): 8 first-wave markets; locales and reasons are **strategic hypotheses**, not verified API-user statistics.
- [keyword-map.csv](keyword-map.csv): keyword candidates mapped to **proposed** pages, search intent, country, language, and future development batch.
- [content-positioning.md](content-positioning.md): claim guardrails, competitor benchmark, sitemap/content plan, internationalization constraints, editorial acceptance criteria.
- [sources-and-measurement.md](sources-and-measurement.md): date-stamped supporting sources and missing baselines.

## Market sequencing
1. Initial research cohort: India (English/Hindi), Brazil (pt-BR), Indonesia (id-ID), Mexico (es-MX), Colombia (es-CO), Nigeria (English), UAE (Arabic/English), Pakistan (English; Urdu if quality-reviewed).
2. Validate actual commercial search demand per locale through Google Search Console, Google Ads Keyword Planner, and manually reviewed SERPs before expanding country-specific pages.
3. Start with English technical intent, localized Portuguese/Spanish/Indonesian product intent, and separately validated Arabic/Hindi demand. **Do not** automatically create eight copies of the same English landing page.
4. Expand to other countries only when organic impressions, qualified trials, paid conversions, sales readiness and compliant product fit support doing so.

## Highest-priority gaps found in repository
- `apps/web/app/sitemap.ts` currently enumerates only `/`, `/pricing`, `/api-docs`, and `/help`.
- `apps/web/components/google-analytics.tsx` tracks only those four public routes; new pages must join a privacy-safe shared indexable registry.
- `apps/web/app/pricing/page.tsx` does not declare page-specific metadata.
- Root HTML language is fixed to English; there is no proven locale-aware public routing/hreflang in the inspected files.
- Public page structured data exists on home; coverage of other pages requires validation.
- Product API documentation has source code examples but no confirmed multi-URL indexable topic architecture.
- Search Console country/query baseline, Bing verification and site crawl results **not obtained**; do not infer zero traffic or successful indexing.

## Release dependencies
**Batch 02:** technical SEO, sitemap and metadata.  
**Batch 03:** GA4 conversion tracking + GSC/Bing baseline.  
**Batch 05:** single-English-site country research architecture, canonical/sitemap guards and no auto geo-language redirects.  
**Batches 06–11:** feature, integrations, country and editorial pages after evidence/copy review.  
**Batch 12:** production crawl + regression suite, then deployment through authorized server push/pull workflow.

## Acceptance checks
- Every numeric adoption/volume/difficulty claim has a named dated source and matching measurement definition; otherwise record `unknown`.
- Draft or untranslated country pages must not be indexed.
- Claims match the actual source and current product limitations.
- No change to existing customer, admin, trial, messaging or billing functionality in Batch 01.
- Requesters and reviewers distinguish **WhatsApp consumer adoption** from **commercial WhatsApp API buyer demand**.
