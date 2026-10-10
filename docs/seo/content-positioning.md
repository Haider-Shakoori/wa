# Positioning, competitor benchmark and content architecture
**Updated:** 2026-10-10. All market/keyword priorities below are hypotheses subject to verified demand, real product behavior and quality review.

## Positioning
**Recommended site headline (draft):** "WhatsApp messaging API for developers — connect your number with QR, send messages through REST, and handle replies with webhooks."

**Accurate technical subtitle (draft):** "RelayWA uses WhatsApp-linked device sessions and supports session-based automation. It is independent of, and is not the official Meta WhatsApp Cloud API."

**What we can demonstrate from repository (not a live SLA promise):**
- `apps/worker/package.json`: `@whiskeysockets/baileys` and `whatsapp-web.js` are dependencies.
- `apps/web/app/docs/page.tsx`: public API examples show `/send-message`, media operations, `/whatsapp-sessions`, webhook resources and sample code in cURL, JavaScript, Laravel/PHP, Python and C#.
- `apps/web/app/page.tsx`: trial CTA of seven days appears in metadata; verify actual signup/billing path before repeating this guarantee on new pages.
- `apps/web/app/layout.tsx`, `apps/web/lib/seo.ts`: root SEO metadata and canonical infrastructure exists.

**Never claim (unless independent verification proves it):**
- Official Meta partner / official WhatsApp Cloud API / verified business number.
- Account ban immunity, guaranteed delivery, unrestricted safe mass messaging or guaranteed 24/7 availability.
- Country-specific data residency, regulatory compliance, regional pricing/taxes/payment acceptance, local language support or 24/7 human support.
- No per-message costs without checking the actual RelayWA plan and external service arrangement.
- n8n *native* integration/SDK until a working maintained package is implemented; generic HTTP + webhook integration is different.

**Safety and accuracy disclosures:** recipients should have supplied a number and agreed to receive the particular type of messages; provide opt-out controls and sender identification. Session-based implementations can be constrained/restricted by WhatsApp. Review the applicable terms and local laws before offering geography-specific guidance.

## Verified public competitor observations (site claims, not independent product performance tests)

| Provider | Directly observed public-site positioning as of 2026-10-10 | RelayWA opportunity / warning |
|---|---|---|
| [WasenderAPI](https://wasenderapi.com/) | QR connection, API snippets across programming languages, webhooks, multi-session messaging, documented free trial and pricing. | We need real, current code examples, convincing screenshots, searchable integrations and transparent plan terms. Do not copy their copy, design, SDK claims or unsupported volume assertions. |
| [Whapi.Cloud](https://whapi.cloud/) | QR-linked channels, webhook automation, developer references, n8n/Make integrations, localized pages for multiple languages. | Prioritize genuine local-language tutorials, REST examples and clear architecture. Claims that a provider is safer or has better deliverability require evidence we do not have. |
| [Meta WhatsApp Business Platform](https://business.whatsapp.com/policy/preview) | Official Meta-governed business platform, with messaging policies and Cloud API-specific rules. | Publish an accurate official-vs-linked-session comparison; do not frame RelayWA as that official API. |

**Evidence limit:** we reviewed public marketing pages and product dependencies. We did not independently test competitors' services, price checkout, scalability, support or customer experience. Update all competitor references before creating a comparison page.

## Content clusters in priority order

| Topic cluster | User outcome | Proposed root pages | Internal links / CTA | Batch |
|---|---|---|---|---|
| REST messaging API | Understand product and try API | `/features/whatsapp-rest-api/`, `/pricing/` | `/api-docs`; signup/trial | 02/06 |
| QR pairing & session lifecycle | Connect existing number | `/features/qr-code-connection/`, `/features/multi-session-management/` | pairing docs, risks, trial | 06 |
| Webhooks & queues | Receive, process, retry events | `/features/webhooks/`, `/blog/whatsapp-webhook-example/` | webhook docs, integration guides | 06/10 |
| Framework integrations | Ship working code | `/integrations/laravel/`, `/integrations/nodejs/`, `/integrations/python/`, `/integrations/dotnet/` | code, API docs, trial | 07 |
| API model decisions | Evaluate tradeoffs | `/compare/cloud-api-vs-qr-api/` | responsible messaging and honest feature matrix | 11 |
| Real use cases | Send useful consented notifications | `/use-cases/order-notifications/`, `/use-cases/customer-support/` | working demo, opt-in guidance | 06/10 |
| Regional support | Evaluate local applicability | only genuinely distinct `/pt-br/`, `/id-id/`, `/es-mx/`, `/es-co/`, `/ar-ae/`, `/hi-in/` | language selector, pricing disclosures and working guides | 05/08/09 |

### Locale rules (especially important)
- Use locale-specific URL paths and valid Google-supported `hreflang` values **only when the entire page has been translated, reviewed and published**.
- Google's Search Central documentation warns that `es-419` is *not* a supported `hreflang` language-region code. Use `es` for shared Spanish (if one real Spanish page), `es-MX` or `es-CO` for actual regional variants; do not use `es-419` as a Google `hreflang` token.
- Locales are **not** a license to create duplicate doorway pages. Only differentiate Mexico and Colombia if copy, terminology, examples or offerings are materially different.
- User-visible localized copy and manual language switching matter; automatic IP/language redirects can obstruct crawling. Maintain reciprocal alternates and canonical rules.
- For an English region with no real unique content, use the global English URL until there is reason to publish a separate variant.

## Editorial acceptance: each proposed indexable page must
1. Answer a single identifiable query and reflect the real product using verifiable screenshots / code / data.
2. Contain original human-reviewed instructions with tested endpoints, auth, sample error response and security guidance where applicable.
3. Have a real target audience, unique title/description/H1, clear internal links and consent-friendly CTA.
4. Disclose WhatsApp Web vs official Cloud API architecture correctly, and flag account restriction risks.
5. Exclude unverified claims, misleading structured data, forged testimonials and unsupported localized guarantees.
6. Enter the sitemap/GA4 allowlist only after it is published, indexable and privacy reviewed.

## Sources for this document
- Google Search Central international SEO: https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites
- Google's supported hreflang: https://developers.google.com/search/docs/specialty/international/localized-versions
- Google's people-first content guide: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- WhatsApp Business policy: https://business.whatsapp.com/policy/preview
- WasenderAPI: https://wasenderapi.com/
- Whapi.Cloud: https://whapi.cloud/
