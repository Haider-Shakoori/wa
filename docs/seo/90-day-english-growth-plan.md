# RelayWA — 90-day English SEO release, editorial and measurement plan

**Prepared:** October 11, 2026. **Period:** First 90 days *after* approved production SEO deployment (launch date not yet confirmed).  
**Status:** Operating plan, not evidence that rollout, indexing, traffic growth or paid conversions have happened.  
**Audience:** Engineering, product, SEO/editorial and platform operators.

## Non-negotiable positioning and release rules

- The website, blog, documentation, titles and meta descriptions remain **English-only**. Local-language keyword phrases may be analyzed privately; do not put them into foreign-language titles or create translated/duplicated country landing pages.
- RelayWA offers **QR-linked WhatsApp Web sessions**, not official Meta Cloud API or Meta BSP services. Disclose account restriction and connection risks. Do not promise immunity from bans, guaranteed delivery, official templates, calling, infinite limits or local/regional hosting without verified functionality.
- Publish one genuinely distinct, useful answer per search intent. Never generate 14 thin geographic doorway pages; revisit Batch 09 only after real country-filtered demand, local buyer relevance and region-specific verified value.
- Never publish unaudited code examples, fictional testimonials/ratings or competitor prices without a dated authoritative source and accountable named review.

## Ownership and gates

| Owner role | Required sign-off or evidence |
|---|---|
| Engineering | Source-contract review, tests for API examples, auth/tenant/billing regression, real HTTP codes and canonicals |
| Editorial | Named human reviewer, unique problem-solving value, accurate title/description, external citations, accessible English copy |
| Security/privacy | Credential, webhook and QR safety; lawful opt-in and opt-out; private dashboards remain noindex and excluded from marketing analytics |
| Release operator | CI/Lighthouse/browser screenshots checked; authorized VPS deployment; post-deploy live sitemap, robots and Search Console checks |
| Analytics | Approved Search Console and Bing ownership, consented GA4 reports, qualified trials and paid-conversion attribution clearly separated |

## Weekly editorial and operating calendar

These are work **candidates**, not pre-approved indexed pages. Reuse `/api-docs`, `/pricing`, `/help` and existing indexed blog tutorials before creating a new URL.

| Week | Intended activity | Search intent and canonical target | Gate |
|---|---|---|---|
| 1 | Approved SEO release, 200/301/404 audit, sitemap submissions, baseline measurement | All currently published English URLs | GitHub CI, mobile Lighthouse, real live crawl, verify Google/Bing access |
| 2 | Review complete Python signed-webhook tutorial, sources and runnable examples | `whatsapp api python`; candidate `/blog/python-whatsapp-api-webhook-workflow` | Python GitHub tests, independent human review, no live secrets |
| 3 | Review .NET 8 transactional notification walkthrough | `whatsapp api c#`; candidate `/blog/dotnet-whatsapp-api-transactional-integration` | .NET fixture tests, consuming-app review and distinct original explanation |
| 4 | Official Meta Cloud API versus QR-linked session comparison | Decision/commercial intent; current `/help` and `/pricing` first | Dated Meta policy/reference, product/security reviewer |
| 5 | Webhook signature and deduplication deep dive | `whatsapp api webhook`; strengthen Node/Laravel articles | Tests for raw-body HMAC, event inbox and retry distinction |
| 6 | QR troubleshooting and safe reconnection examples | `whatsapp api qr code`; existing QR article | Live staging source check; preserve secret/QR privacy |
| 7 | Accurate send status, unknown outcomes and clientMessageId guidance | Developer failure/retry intent; current `/api-docs#queue` | NestJS/worker tests, no guaranteed delivery claim |
| 8 | Laravel order events and idempotent app integration | `whatsapp api laravel`; existing Laravel tutorial | Real Laravel consuming-app tests and verified webhook storage |
| 9 | n8n low-code HTTP request integration examples | `whatsapp api n8n`; existing `/api-docs#integration-n8n` | Only publish independent new tutorial if meaningfully more than canonical docs |
| 10 | Vendor evaluation guide: pricing, capabilities and official status | Provider-comparison search intent; evidence dossier only initially | Live vendor primary source links, dated pricing, human review; no misleading rankings |
| 11 | Update top two articles from *actual* GSC query and engagement observations | Existing English articles/pages with real impressions | Source-verified revision; do not change date just to feign freshness |
| 12 | Refine organic signup journey and technical performance | Homepage, pricing and article CTAs | Consent-aware GA4 events, registration/Stripe safe QA, mobile CWV |
| 13 | 90-day review: retain, consolidate, rewrite or deindex | All published routes and 14-country research matrix | Country-qualified funnel, technical health and documented next-quarter decision |

## Technical weekly cadence

1. Every week: inspect Search Console coverage/indexing, crawl errors, server 5xx/404s, sitemap and robots status, security changes, social/canonical/structured-data regressions, broken editorial/source links and changed API DTOs. Keep published examples synchronized to source.
2. Every week: run GitHub standard CI and mobile browser preflight against public changes; review mobile performance and Core Web Vitals warnings, not just Lighthouse SEO 100. Audit docs LCP and pricing CLS that were previously flagged.
3. Every two weeks: reconcile keyword-query country/language *research* with real country-filtered impressions and qualified signup events. Keep aggregate-only analytics; do not send tenant paths, phone numbers or API credentials into GA4.
4. Every four weeks: audit the top indexed English pages for copied claims, external-source freshness, broken links, exact code response contracts, factual competitor differences and needed reviewer follow-up.
5. At 30, 60 and 90 days: evaluate growth only against the measured post-launch baseline; the initial baseline is **not yet verified**. Record decisions with evidence and avoid publishing doorway country pages.

## Measurement worksheet — values unknown until verified

| KPI | Authoritative evidence | Initial value | Direction to review |
|---|---|---|---|
| Nonbrand organic impressions by country | GSC Performance query + country/date filter | Unknown | Trend and demand fit; do not mix search volume with visits |
| Nonbrand clicks/CTR and landing page | GSC property country/page export | Unknown | Helpful pages and intent match |
| Indexed published URLs; unexpected indexed drafts | GSC Page indexing + site crawl | Unknown | All reviewed URLs eligible, no draft/private exposure |
| Qualified organic trial starts | Consent-aware GA4 plus first-party signup attribution when implemented | Unknown | Verify channel-to-trial join, no invented paid attribution |
| Activated sessions from organic signups | First-party platform events with privacy review | Unknown | Only count real activated trials |
| Organic-attributed first payment | Approved attribution path + verified Stripe/database payment records | Unknown | Until #96 is implemented, label paid as **all-channel** |
| Mobile LCP/INP/CLS | CrUX/field data (when available), local Lighthouse as separate lab | Unknown | Fix real field regressions |
| Relevant developer references/backlinks | Validated referral domains and editorial links | Unknown | Prefer organic citations to tested developer examples |

## Ethical promotion and expansion

Publish genuinely useful integration examples, participate in developer Q&A communities with direct relevant help, share original code-based walkthroughs and submit to appropriate technical resource directories *only if allowed by their rules*. Do not purchase link packages, auto-generate comments or run mass-spam outreach. Avoid claiming partner endorsements.

Review 14 researched markets: United States, India, Pakistan, Brazil, Indonesia, Mexico, Colombia, Nigeria, UAE, Saudi Arabia, South Africa, Spain, Germany and United Kingdom. Regional English pages are only a later possibility when **actual** qualified country search demand, English buying relevance, unique local buyer details, verified payment/plan availability and human review exist. Local-language Ahrefs values from screenshot buckets are not exact rankings, traffic or sales.

## Final decision checklist

- **30-day:** Deployment and indexation verified; no private/draft leaks; first true GSC country/query baseline and funnel source map.
- **60-day:** At least one maintained, source-tested developer workflow with independent editorial approval, and practical corrections based on real query evidence.
- **90-day:** Decide which pages to maintain/consolidate, whether country pages have earned publication, and which technical/performance issue has strongest measured qualified-demand impact. Report unknown figures as unknown, not zero or fabricated success.

**Dependencies to close outside this plan:** Batch 09 real country buyer evidence; Batch 10 consuming-app/worker and reviewer signoff; Batch 11 independent comparative source/security review; Batch 12 live rollout, GSC/Bing setup and release permission. Keeping this calendar does not close those gates.
