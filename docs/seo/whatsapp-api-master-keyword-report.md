# RelayWA — WhatsApp API keyword master report (14 countries)

**Research assembled:** 11 October 2026  
**Product:** RelayWA — independent **QR-linked WhatsApp Web session API**, **not** Meta's official WhatsApp Business Platform/Cloud API  
**Website language:** **English only** (public pages, H1, title/description, docs, CTAs, registration). All other languages are **research only**.  
**Primary deliverable:** [98-row Ahrefs screenshot master CSV](whatsapp-api-ahrefs-14-market-master.csv)  
**Validation:** [offline read-only audit](../../scripts/seo-master-keyword-audit.mjs) and [automated regression](../../apps/web/test/seo-ahrefs-master-keyword-report.test.mjs)  
**Coverage:** The existing **13 researched markets** (India, Brazil, Indonesia, Mexico, Colombia, Nigeria, UAE, Pakistan, Saudi Arabia, South Africa, Spain, Germany, UK) **plus USA as the 14th market**.

## What the evidence actually is

The user supplied **14 screenshots of Ahrefs Free Keyword Generator** for the phrase-match seed `WhatsApp API`, each with one country database selected. Screenshots were supplied in the conversation on 10–11 October 2026. Each displayed the *first 20* keywords of a larger suggestion list, a country-specific **search-volume bucket** (`>10,000`, `>1,000`, `>100` or `<100`) and, for selected keywords, an Ahrefs KD **qualitative label** (Easy/Medium/Hard). In many rows the difficulty was not available, blank, or gated behind sign-up. The master file faithfully preserves that distinction.

**These are not exact monthly volumes, guaranteed keyword rankings, traffic estimates, indexed page counts, Global Search Volume or confirmed subscriptions.** `>100` means only that the tool displayed a threshold above 100 for that country and term; no precise count is inferable. Do not add the buckets across countries or subtract them as if exact values. Ahrefs measures estimation, not official Google totals.

The CSV contains **98 country-keyword pairs** selected for direct/adjacent developer and buyer intent (7 per country); the same term across countries is *not* 14 globally distinct terms. Separately, the suggestion counts in each screenshot sum to **22,441 country-database ideas**; this is not a de-duplicated count of distinct keywords and is **not search volume**. No Ahrefs full export was available, so the additional unshown suggestions were not fabricated.

**Evidence provenance:** column `source_screenshot` is the exact source image filename from the conversation. Screenshots have **not** been copied into the repository. The dataset is manual transcription and intent classification, not independently re-run paid Ahrefs research. Any uncertainty must remain explicitly visible.

## 1. Main-keyword benchmark

| Country | Keyword suggestions in screenshot | `whatsapp api` Ahrefs volume bucket | Ahrefs KD |
|---|---:|---|---|
| United States (US) | 3,764 | >1,000 | Hard |
| India (IN) | 2,855 | **>10,000** | Hard |
| Pakistan (PK) | 1,319 | >1,000 | **Easy** |
| Brazil (BR) | 2,238 | >1,000 | **Easy** |
| Indonesia (ID) | 1,615 | >1,000 | Medium |
| Mexico (MX) | 1,424 | >1,000 | **Easy** |
| Colombia (CO) | 1,189 | >1,000 | **Easy** |
| Nigeria (NG) | 814 | >100 | Hard |
| United Arab Emirates (AE) | 1,163 | >100 | Hard |
| Saudi Arabia (SA) | 995 | >100 | Medium |
| South Africa (ZA) | 960 | >100 | Hard |
| Spain (ES) | 1,274 | >1,000 | **Easy** |
| Germany (DE) | 1,225 | >1,000 | **Easy** |
| United Kingdom (GB) | 1,606 | >1,000 | Hard |

**Interpretation:** Exactly **six** main-keyword country records are rated Easy in these images: **Pakistan, Brazil, Mexico, Colombia, Spain, Germany**. This is a *difficulty signal*, not proof that a global English-only site will rank effectively for local-language queries. India has the biggest observed volume bucket (`>10,000`), with a Hard label.

## 2. Commercial and developer opportunities worth reviewing

| Market | Screenshot keyword | Reported bucket | KD | Existing English target | Editorial rationale |
|---|---|---|---|---|---|
| US | whatsapp api pricing | >100 | Easy | `/pricing` | Purchase intent, strong product fit |
| US | best whatsapp api provider | >100 | Easy | `/` | Comparison intent, requires substantiated vendor analysis before new article |
| US | whatsapp api integration | >100 | Easy | `/api-docs` | Developer integration fit; expand genuinely useful recipes |
| US | whatsapp api documentation | >100 | Not shown | `/api-docs` | Good link target, not evidence of low KD |
| IN | whatsapp api for business | >1,000 | Easy | `/` | High bucket, but many users mean *official* Business API; disclose QR-based model |
| IN | whatsapp api pricing | >1,000 | Hard | `/pricing` | High commercial bucket and competition |
| IN | wati whatsapp api | >1,000 | Easy | `/help` | Competitor search, only fair dated comparisons |
| PK | whatsapp api | >1,000 | Easy | `/` | English main-term opportunity; check actual SERP and buyer intent |
| PK | whatsapp api free | >100 | Easy | `/pricing` | Explain **time-limited free trial**, not permanently free API |
| BR | whatsapp api | >1,000 | Easy | `/` | Check whether English page matches Portuguese user expectations |
| ID | whatsapp api indonesia | >100 | Easy | `/` | Geographically relevant query; no auto-made `/countries/indonesia` page |
| ID | cara membuat whatsapp api | >100 | Easy | `/api-docs` | Indonesian informational intent; validate English-language content suitability |
| MX | whatsapp api | >1,000 | Easy | `/` | Check Spanish SERP before prioritizing |
| CO | whatsapp api business | >100 | Easy | `/` | Clarify unofficial QR session product |
| CO | que es whatsapp api | >100 | Easy | `/help` | Spanish educational intent, potential English mismatch |
| AE | whatsapp api pricing | >100 | Easy | `/pricing` | Pricing opportunity for regional English-language search |
| SA | whatsapp api pricing | <100 | Easy | `/pricing` | Low displayed volume, despite easy rating |
| ES | whatsapp api | >1,000 | Easy | `/` | Validate Spanish SERP and whether English content meets user intent |
| DE | whatsapp api kosten | >100 | Easy | `/pricing` | German-language price intent; English page visibility uncertain |
| DE | whatsapp api | >1,000 | Easy | `/` | Country-specific SERP follow-up required |
| GB | whatsapp api send message | <100 | Easy | `/api-docs` | Low bucket but accurately matches existing docs |

**Candidate selection note:** This is an *editorial shortlist*, not a deterministic ranking of easy keywords. Priority in the CSV considers relevance, intent, disclosed product capability, search-language gap, and observed Ahrefs thresholds. It is a **hypothesis** until SERP/content fit and actual GSC/GA4 outcomes are verified.

## 3. Search intent clusters and canonical page mapping

| Cluster | Example phrases | Current URL | What to do next |
|---|---|---|---|
| Generic/solution | whatsapp api; whatsapp api provider | `/` | Keep one substantive global English homepage and QR-linked vs official product explanation |
| Pricing and trial | whatsapp api pricing; whatsapp api cost; whatsapp api kosten; whatsapp api free | `/pricing` | Accurately explain actual plans, billing, trial limits, no invented local currency/tax conditions |
| Developer workflows | whatsapp api integration; whatsapp api send message; whatsapp api documentation; whatsapp api key | `/api-docs` | Add **tested workflows not redundant copied endpoint guides**; maintain accurate error/webhook/auth examples |
| Educational/question | que es whatsapp api; cara membuat whatsapp api | `/help` or `/api-docs` | Validate if English content meets non-English SERP intent before modifying anything |
| Competitor comparisons | WATI/Twilio/“best provider” | Existing explanatory page until justified | Future evidence-backed comparison; no invented features, dates, rankings or claims |
| Official-only searches | whatsapp api oficial; whatsapp api oficial preço; whatsapp api cloud | Research hold / existing `/help` for explanatory mapping only | **Do not position RelayWA as Meta Cloud API**, do not purchase official-intent traffic |

**Do not publish** `/countries/*`, `/integrations/*`, `/pt-br/*`, `/es/*`, localized title tags, `hreflang`, or foreign-language keyword blocks from this dataset. The existing four indexable English routes stay the only targets for now. Source-language terms may be studied to understand intent, not sprinkled into hidden metadata.

## 4. What is *not* suitable for aggressive targeting

- **Official Meta WhatsApp API / Cloud API** queries: customers are seeking something RelayWA does not provide; use only a fair technical comparison that identifies official and unofficial options.
- **WhatsApp voice calling** queries (`whatsapp api call` in Mexico/UAE): the screenshot shows demand, **not** proof that RelayWA supports API calls. Do not promise or optimize for an unverified capability.
- **High-risk messaging claims:** do not market bypasses, guarantees against bans, unsolicited bulk messaging, official affiliation, guaranteed delivery or country-specific regulatory approvals.
- **Banking and compliance-heavy applications:** keep as research-only until functional, security, legal and buyer-intent review.
- **Generic popularity content:** traffic from WhatsApp profile-image download articles does not prove meaningful developer trial conversions.

## 5. Decision gates before implementing Batches 09–11

1. **Review top 10 actual search results for priority keyword-country pairs.** Record what the searcher is asking for, page languages, official-vs-unofficial expectations, competing content/offerings, and whether the English RelayWA page truly satisfies the need. Ahrefs Easy is not a ranking guarantee.
2. **Get actual keyword volume where possible.** Run keyword-specific searches in Google Ads Keyword Planner or paid Ahrefs/Semrush for matching country/language; save dated, sourced exact estimates separately. Do not overwrite screenshot buckets with guessed numbers.
3. **Analyze native-language primary variants** separately (`API do WhatsApp`, `API de WhatsApp`, etc.). The present images are mostly *English-seed* `WhatsApp API` suggestions, not comprehensive language research.
4. **Measure existing site visibility** through country-filtered Search Console queries, impressions and pages, if/when access is available. Existing GSC Wizard connection returned `payment_required` in Batch 08; no authenticated RelayWA query metrics were retrieved. Exported GSC impressions are **not total search volume**, and organic clicks are **not paid conversions**.
5. **Validate business outcomes** with privacy-safe signup/trial metrics and actual subscription activation data, without inventing attribution.
6. **Publish only reviewed original English content.** Batch 09 country pages remain evidence-gated; do not create 14 doorway pages. Batch 10 tutorials should solve gaps not covered by existing docs. Batch 11 comparisons require dated feature/pricing evidence.

## 6. Suggested editorial sequence (not published content)

| Wave | Focus | Why |
|---|---|---|
| Wave A | `/pricing` and `/api-docs` English copy/clarity | US and AE pricing, US integration and developer documentation; existing relevant pages |
| Wave B | Developer tutorials in English | Authenticated request, webhook validation, application queues/retries; write complete distinct workflows, not duplicate docs |
| Wave C | Official vs QR-linked model comparison | Honest high-intent decision support, avoid Cloud API misrepresentation |
| Wave D | Evidence-backed vendor comparisons | WATI, WAHA, Whapi.Cloud or Twilio only with checkable current facts |
| Wave E | Country-specific English content if qualified | Only if country SERPs and buyer context reveal truly distinct needs |

## 7. Reproduction and limitations

From the repo root:

```sh
node scripts/seo-master-keyword-audit.mjs
```

This checks **98 rows, 14 markets, 7 records per screenshot, provenance references, allowed bucket and KD values, six Easy main-keyword markets, English-only canonical mapping and no publication changes**. Automated regression test is `apps/web/test/seo-ahrefs-master-keyword-report.test.mjs`.

**Metadata limitations:** Ahrefs “Updated” timestamps visible in screenshots differ by row. These are a time-of-capture snapshot; the report does not claim a single updated-at date for the entire dataset. The screenshots are the user-supplied evidence, not independently audited by Ahrefs's paid API. All SEO conclusions are provisional until native-language SERP and Google Search Console/analytics validation.

**No new country pages** or other indexable content are authorized by this keyword research.\n\n**Release boundary:** This report is a research artifact. It changes no production marketing page, indexable content, sitemaps, billing, API, or user data. **No VPS deployment.**
