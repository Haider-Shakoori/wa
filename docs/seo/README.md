# RelayWA international SEO — Batch 01
**Research snapshot:** 2026-10-10  
**Status:** strategy and repository audit; **not** a production crawl, keyword-volume report, deployment, or rankings certification.  
**Issue:** https://github.com/Haider-Shakoori/wa/issues/78

## Decision
Position RelayWA as a **developer-focused WhatsApp-linked-session messaging API**: pair an existing number via QR, send and receive supported message types via REST, manage multiple sessions, receive webhooks, and use subscription-controlled workspaces. The implementation currently uses Baileys and Chromium/whatsapp-web.js, **not the official Meta WhatsApp Cloud API**. No promise of official partnership, verified business account, guaranteed deliverability, zero ban risk, unlimited safe messaging, or country-specific regulatory compliance.

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
**Batch 05:** locales, reciprocal hreflang and human-reviewed language switch.  
**Batches 06–11:** feature, integrations, country and editorial pages after evidence/copy review.  
**Batch 12:** production crawl + regression suite, then deployment through authorized server push/pull workflow.

## Acceptance checks
- Every numeric adoption/volume/difficulty claim has a named dated source and matching measurement definition; otherwise record `unknown`.
- Draft or untranslated country pages must not be indexed.
- Claims match the actual source and current product limitations.
- No change to existing customer, admin, trial, messaging or billing functionality in Batch 01.
- Requesters and reviewers distinguish **WhatsApp consumer adoption** from **commercial WhatsApp API buyer demand**.
