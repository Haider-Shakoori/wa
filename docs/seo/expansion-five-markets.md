# Five-market international SEO expansion assessment
**Research date:** 2026-10-10  
**Tracked by:** [SEO research extension #92](https://github.com/Haider-Shakoori/wa/issues/92)  
**Decision status:** Research cohort, **not** immediate launch authorization. Original eight Wave-1 markets remain unchanged.  
**Product fit:** RelayWA is a QR-linked WhatsApp-session REST/webhook service using Baileys and Chromium-based connection engines, not Meta's official WhatsApp Cloud API.

## Decision table

| Market | Internet users, October 2025 (DataReportal) | SEO approach | Suggested planning wave | Why / caveat |
|---|---:|---|---|---|
| Saudi Arabia (SA) | 34.4m | Extend reviewed Arabic content from UAE; differentiate Saudi pages only where pricing, examples and product availability differ | Wave 2 candidate | Highly connected population; Arabic official Business API competitors visible, so clearly label RelayWA as QR/session-based. |
| South Africa (ZA) | 51.7m | Reuse global English developer guides; validate local `REST API`, `Node.js`, webhook and QR intent | Wave 2 candidate | English technical SEO can be tested at low localization cost, but business demand and compliant product-market fit are unmeasured. |
| Spain (ES) | 46.1m | Spanish developer content with carefully reviewed Spain-specific terminology; avoid copying Mexico/Colombia pages | Wave 2 candidate | Spanish-language WhatsApp API pricing/docs competitors publish relevant content; QR and developer differentiation must be genuine. |
| Germany (DE) | 78.5m | Research-first: write an accurate German proof-of-concept integration article, prioritize trust and precise product positioning | Wave 3 conditional | German-language official Meta BSPs already publish developer API documentation; privacy and service expectation differences need specific review. |
| United Kingdom (GB) | 68.1m | Reuse global English API/pricing/integrations; consider `en-GB` only with materially distinct local content | Wave 3 conditional | High English market reach, but local keyword demand and incremental gains from UK-only pages are unknown. |

**Definition:** Internet users are individuals who use the internet, **not** WhatsApp user counts, businesses that buy WhatsApp API services, searches, impressions, or customers. These 2026 report pages use late-2025 data. No country-specific WhatsApp API search-volume figures were obtained; the planned Wave-2/Wave-3 grouping is an editorial prioritization, not measured market-share ranking.

### Strategy by market

**Saudi Arabia:** Proposed searches include `واجهة برمجة واتساب للمطورين` (WhatsApp API for developers) and `ربط واتساب عبر رمز QR` (connect via QR). The visible local examples emphasize the *official* WhatsApp Business Platform; our copy must distinguish Meta Cloud API from our linked-device approach. Avoid publishing Saudi-specific currency, official approval, residency or legal claims before verifying live billing and compliance details.

**South Africa:** English, developer-focused pages may work across the current English site. Test QR pairing, REST/Webhooks, PHP/Node integration, opt-in order notifications. Clickatell provides an example of official WhatsApp Business API product messaging, not proof of country-specific organic rankings or purchase volumes. Only publish `en-ZA` when offering substantive local information, not a thin duplicate.

**Spain:** Begin with verified Spanish technical material and pricing explanation, then assess whether `es-ES` requires a country page; `es-MX` and `es-CO` are already planned, but Google expects correct reciprocal `hreflang` on genuinely published variants. Comparisons must separate official Meta fees vs RelayWA SaaS subscription model accurately. Spanish competitors include Whapi's Spanish documentation and ManyContacts' Spain-oriented price guide.

**Germany:** Target `WhatsApp Web API mit QR-Code` and `WhatsApp REST API für Entwickler`, not undifferentiated `offizielle WhatsApp Business API` promises. Strong language/reputation demands: native review of German docs, a clear comparison with official Cloud API, and precise privacy/hosting promises. 360dialog has German-language official API marketing and developer examples, demonstrating visible competing content (not search volume).

**United Kingdom:** Existing English documentation and integration pages are the low-cost first experiment; monitor country-specific GSC impressions and trial-to-paid, then consider `en-GB` only if distinctive examples, pricing terms, regulations or case studies justify it. Do not manufacture `/uk/` pages.

## Keyword strategy
- Initial candidate phrases in [expansion-keywords.csv](expansion-keywords.csv) are **SEO hypotheses only** and require independent localized SERP and volume checks.
- Product-match gate: only rank and advertise searches where RelayWA's QR/WhatsApp Web-based behavior satisfies user intent.
- For queries that imply official Meta Business Platform, provide a transparent educational comparison rather than a misleading product landing page.
- Start with existing content clusters: `/features/whatsapp-rest-api/`, `/features/qr-code-connection/`, `/features/webhooks/`, `/integrations/nodejs/`, `/integrations/laravel/`, `/pricing/`; all are **proposed** unless their route exists in code.
- In Batch 05, use actual language+region supported codes like `ar-SA`, `en-ZA`, `es-ES`, `de-DE`, `en-GB`, but only for real published pages. A generic English page can rank internationally without a separate regional URL.
- First production action is **not** building five cloned country pages. Use country-filtered analytics to choose whether a new localized page is warranted.

## Competitive observations, not ranking measurements
| Focus | Public evidence | Interpretation |
|---|---|---|
| SA official API | https://corbit.sa/products/whatsapp and https://www.360dialog.com/ar/whatsapp-business-api | Arabic-language provider messaging exists; avoid mimicking official-BSP promises. |
| ZA official API | https://www.clickatell.com/products/whatsapp/ | A documented enterprise BSP alternative; no inferred local SEO share. |
| ES developer API | https://whapi.cloud/es/docs and https://www.manycontacts.com/blog/precio-whatsapp-business-api/ | Spanish developer and pricing content exists; clear differentiated docs matter. |
| DE developer API | https://360dialog.com/de/whatsapp-api and https://respond.io/de/help/whatsapp/whatsapp-api-quick-start | German official API guides exist; RelayWA needs explicit linked-device distinction. |
| GB and global English | https://api.wasenderapi.com/api-docs/ and https://whapi.cloud/docs | Established English documentation competes for developer-intent searches. |

## Evidence register: geographic reach (all accessed 2026-10-10)
- SA: https://datareportal.com/reports/digital-2026-saudi-arabia — 34.4 million internet users at end 2025.
- ZA: https://datareportal.com/reports/digital-2026-south-africa — 51.7 million.
- ES: https://datareportal.com/reports/digital-2026-spain — 46.1 million.
- DE: https://datareportal.com/reports/digital-2026-germany — 78.5 million.
- GB: https://datareportal.com/reports/digital-2026-united-kingdom — 68.1 million.
- International SEO codes/reciprocity: https://developers.google.com/search/docs/specialty/international/localized-versions

## Measurements still required before launch
1. Google Search Console: settled 28- and 90-day clicks, impressions, CTR, position and indexed pages per target country.
2. Google Ads Keyword Planner or approved equivalent: average monthly volume, period, geo/language settings, difficulty proxy and SERP evidence **per keyword**; all currently `unknown`.
3. GA4/first-party: organic landing visits, new trial activation, subscription conversion, refund/retention by locale where privacy-preserving.
4. Validate payment options, supported languages, privacy notices, product trial and responsible messaging fit.
5. Country-filtered SERP manual spot checks in proper geographic settings. A general web search does not prove ranking order for any country.

**Operational guardrail:** Adding research markets does not expand the public sitemap, GA4 tracking, locale URLs or paid targeting automatically. Later implementation requires review, localized content and tests.
