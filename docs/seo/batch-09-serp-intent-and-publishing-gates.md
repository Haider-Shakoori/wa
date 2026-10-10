# RelayWA Batch 09 — Live SERP intent check and English content decisions

**Evidence date:** 2026-10-11  
**Status:** **Country landing pages held pending buyer/GSC/unique-value evidence.** Existing English `/pricing` receives a focused product-model clarification, but this is **not evidence of completed international landing-page qualification or measured SEO growth**.  
**Related:** [Batch 09 country-page gate](https://github.com/Haider-Shakoori/wa/issues/86), [Batch 10 tutorials](https://github.com/Haider-Shakoori/wa/issues/87), [Batch 11 comparisons](https://github.com/Haider-Shakoori/wa/issues/88).  
**Inputs:** 14-country user-provided Ahrefs screenshot [keyword master](whatsapp-api-ahrefs-14-market-master.csv) and [report](whatsapp-api-master-keyword-report.md), plus current public geo-targeted search samples in [evidence CSV](batch-09-country-serp-evidence.csv).

## Scope and reliability limits

This was a sample of **public search results retrieved using market-specific search settings**. Such results are **not** an authenticated country-filtered Google Search Console report, a reproducible logged-in Ahrefs Organic SERP report or an exhaustive **top 10 Google SERP snapshot**. Results vary with time, personalization, location, query and language. We retain **one real example URL and an exact research query per country** for reproducibility. Positions, backlinks, clickthrough rates, indexation, exact search volume, domain authority and live signups **were not verified** and should not be inferred from the example URLs.

The screenshot's "Easy" keyword difficulty is an Ahrefs estimate. A generic commercial search for "WhatsApp API" often emphasizes **Meta's official Business Platform/Cloud API and authorized BSP offerings**. RelayWA is instead an independent **QR-linked WhatsApp Web session API**; calling its product the official Meta API would be materially misleading.

**Country-page decision:** No country has sufficiently demonstrated all of (a) identifiable buyer demand relevant to an *unofficial QR session service*, (b) unique English-market material, (c) confirmed availability of local trial/subscription/payment functionality and risks, and (d) measurable query/country behavior for RelayWA. **Hold all `/countries/*` pages**; they would presently be generic pricing/API pages with exchanged country names, not helpful differentiated resources. Researching local-language queries is permitted, but live website/metadata/docs remain **English only**.

Google Search Central specifically flags multiple region/city-targeted pages funneling users to a single final destination as a doorway-abuse pattern: https://developers.google.com/search/docs/essentials/spam-policies ; and describes regional duplicate canonical decisions: https://developers.google.com/search/docs/crawling-indexing/canonicalization .

## 1. Fourteen-country sampled-search classification

The full evidence CSV gives the actual search expression, result URL, language, fit assessment, existing English destination, and unresolved checks.

| Market | Query sample emphasis | Evidence example | Content-language / intent gap | Publish country page? |
|---|---|---|---|---|
| USA | API price and integration | [Meta pricing documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) | Most results explain official platform fees; RelayWA bills linked sessions | **No** |
| India | Business API | [WATI Business API guide](https://www.wati.io/en/blog/discovering-whatsapp-business-api/) | Business terminology often refers to Meta Cloud API | **No** |
| Pakistan | WhatsApp API providers | [Pakistan official API providers](https://www.intellicon.io/whatsapp-business-api-provider-pakistan/) | Local provider comparisons are primarily for approved Meta BSPs; check [QR-API niche](https://www.hajanaone.com/whatsapp-API-in-Pakistan.php) separately | **No** |
| Brazil | API pricing | [Meta Portuguese pricing](https://whatsappbusiness.com/pt-br/products/platform-pricing/) | Native-Portuguese official-service intent; English and architecture mismatch | **No** |
| Indonesia | API providers | [resmi.id](https://whatsapp.resmi.id/) | Indonesian official BSP intent; local-language coverage | **No** |
| Mexico | API pricing | [Meta Spanish pricing](https://whatsappbusiness.com/es-la/products/platform-pricing/) | Spanish market pricing for official platform | **No** |
| Colombia | API providers | [Optimify official partner](https://optimify.ai/api-de-whatsapp-somos-el-partner-oficial-de-whatsapp/) | Spanish official-partner intent | **No** |
| Nigeria | API providers | [Siteti Nigerian offering](https://www.siteti.com/solutions/official-whatsapp-api-provider/) | Naira billing and Nigerian compliance claims require actual local proof for RelayWA | **No** |
| UAE | Pricing | [Meta published rates](https://whatsappbusiness.com/products/platform-pricing/) | Official categories and per-message rates vs independent session subscription | **No** |
| Saudi Arabia | Provider search | [Taqnyat](https://taqnyat.sa/en/channels/WhatsApp-Business-API-service-provider/) | Saudi-specific provider intent, unverifiable local RelayWA differentiation | **No** |
| South Africa | API price/provider | [CM.com South Africa](https://www.cm.com/en-za/whatsapp/) | Official BSP/local fees dominate public sample | **No** |
| Spain | API price/provider | [Spanish 2026 API costs](https://engrana.es/blog/precio-whatsapp-business-api-espana) | Spanish-language explanation of official fees | **No** |
| Germany | API cost/provider | [German API costs](https://www.hellomateo.de/ressourcen/blog/whatsapp-business-api-kosten) | German-language official billing and local legal expectations | **No** |
| UK | Provider/pricing | [Meta published rates](https://whatsappbusiness.com/products/platform-pricing/) | UK query sampled primarily returns official channels | **No** |

**Niche validation**: QR-linked alternative queries have a more relevant result mix, for example [Unipile's WhatsApp API integration guide](https://www.unipile.com/whatsapp-api-a-complete-guide-to-integration/), [Hajana One Pakistan QR API](https://www.hajanaone.com/whatsapp-API-in-Pakistan.php) and [WBIZTool Germany QR linking](https://wbiztool.com/de/whatsapp-api/). These are **discovery examples**, not verification of rankings, sales, security equivalence or whether their model exactly matches RelayWA.

## 2. Actual English pricing improvement shipped with this PR

**`apps/web/app/pricing/page.tsx`** now includes a server-rendered comparison with the headline **"QR-linked API subscription vs. Meta's official API pricing"**. The content transparently distinguishes:
- RelayWA's QR-linked session subscription model and existing API keys, without claiming Meta approval or magical delivery guarantees;
- Meta's official Business Platform fee model, which may vary by market/message category and provider, linked to official [Meta pricing](https://whatsappbusiness.com/products/platform-pricing/);
- when the official route is more appropriate, and links to existing actual RelayWA session/retry docs.

The feature does not change live plan pricing, Stripe, subscription calculations, trial limits, country billing rules or meta-title tags. The existing plan cards remain API-driven. No claims that RelayWA supports WhatsApp voice calls, official Meta templates, BSP status or unsupported geographical payment methods are introduced.

### Priority decision on existing English pages

| Page | Decision | Acceptance |
|---|---|---|
| `/pricing` | **Implement now** semantic model distinction | Official pricing linked, clarify QR/session model and limitations; preserve live plan cards |
| `/api-docs` | **Retain existing framework guides** | Improve complete runnable workflows in *different* tutorial content, not duplicated reference snippets |
| `/` | Retain English positioning | Already discloses QR sessions, 7-day trial and lack of official affiliation; avoid generic country-variant copies |
| `/help` | Retain FAQ | Link from future guide where risk/constraints questions matter, without cloning FAQs |

## 3. Original article specifications for future Batches 10–11

These are editorial briefs, **not published articles**. Do not invent SDKs or claim integration tests passed.

### A. Laravel transactional messaging workflow — Batch 10

**Intent:** WhatsApp API Laravel / send order update / webhook signed callback.  
**Distinct value:** Full Laravel service with `Http::withToken`, config/env, opt-in trigger, idempotency key, job pacing/retry backoff, failure logging, HMAC signature check using **raw body**, HTTP mock tests and safe secret handling. Link to existing `/api-docs#integration-laravel` as canonical API reference instead of duplicating it.  
**Publication requirement:** CI-run tests on repo-supported Laravel or a fixture/test project; no untested runnable code claim. Clearly label QR-linked session model.

### B. Node.js + webhook integration — Batch 10

**Intent:** WhatsApp REST API send message and receive delivery events.  
**Distinct value:** Self-contained Node.js example, server-side Bearer credentials, webhooks, HMAC verification using the *raw* request payload, retries managed **by the caller** (RelayWA does not provide automatic outbound retry queue), and fixture-based tests. Link to docs `#integration-nodejs`, `#webhooks` and `#queue`.  
**Publication requirement:** Test POST failure/success and sample webhook signature; no unsourced guarantee of message delivery.

### C. How to choose official Meta Cloud API versus QR-linked sessions — Batch 11

**Intent:** WhatsApp Business API vs QR API; pricing differences.  
**Distinct value:** Factual, neutral matrix of authorization and compliance, pricing unit, onboarding and phone connection, account restriction risk, support, suitable use cases. **State unambiguously that the official Meta route is preferable when official authorization and lower unofficial-client risk are required.** Include Meta's directly sourced policies and user-consented messaging requirements.  
**Publication requirement:** Date-stamped official source citations, review by product/security, accurate features and actual disclosed terms.

### D. Developer-focused QR session troubleshooting — Batch 10

**Intent:** WhatsApp API QR code disconnected, webhooks missing, duplicate deliveries.  
**Distinct value:** A testable diagnostic decision tree for linked session states, reconnection, `clientMessageId` handling, webhook delivery vs outbound transport and app-level retries. Link to existing FAQ and docs.  
**Publication requirement:** Validate actual implemented RelayWA session state names and end-to-end integration behavior before publishing. Do not overpromise reconnection.

### E. Verified provider comparison — Batch 11

**Intent:** WhatsApp API provider comparison, Whapi.Cloud, WaSenderAPI, WATI, official API.  
**Distinct value:** Current independently checkable supported features, pricing and official/unofficial architecture; practical task-by-task evaluation, not copied vendor claims or an unsupported "best provider" ranking.  
**Publication requirement:** Fetch current official vendor documentation/prices, note check date and unknowns, avoid implying affiliation or unfounded ban-safety guarantees.

**Editorial order:** current English `/pricing` clarity → Laravel/Node integration article with tests → signed webhooks/QR troubleshooting → official-vs-unofficial comparison → verified vendor review, subject to actual search/buyer signals. Rank growth and organic-to-paid conversion remain **unverified**.

## 4. Completion gates still open for Batch 09

- [x] Compare regional intent using public evidence (this PR; one non-exhaustive query sample per country).
- [x] Set **hold** for weak/dublicative country pages and preserve English-only site.
- [x] Improve an already-indexable English page where competitor intent reveals genuine product confusion.
- [ ] Obtain verified country-filtered **RelayWA** GSC query/impressions/landing-page evidence (GSC Wizard previously reported inactive subscription).
- [ ] Verify market-specific buyer intent, payment availability and local product features for any proposed country page.
- [ ] Review complete market-localized search engine page 1 results or GSC/paid SERP exports for shortlisted country terms, if a new regional page is pursued.
- [ ] Approve genuinely distinct original English content before adding a new country URL.

**Batch 09 remains open** until a documented publish/no-publish decision can be made with the required product and buyer evidence. No artificial country pages and no fake metrics. Deployment to the VPS remains separate.
