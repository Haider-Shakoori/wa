# RelayWA SEO Batch 11 — first source-reviewed trust and API-model comparison

**Evidence collected:** October 11, 2026. **Published in code:** Only an additive, English-language section on the existing `/help` page. No comparison landing URL, independent review claim, stars, testimonial, endorsement, or vendor pricing claim.

## Primary factual sources

| Primary source | URL | Verified point / review boundary |
|---|---|---|
| Meta WhatsApp Cloud API reference (Meta-maintained Postman collection) | https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api | Official Cloud API is hosted by Meta; setup uses Meta Business assets and API tokens, not QR-linked WhatsApp Web sessions. |
| WhatsApp linked device help | https://faq.whatsapp.com/378279804439436/ | WhatsApp warns unofficial linked-device sites/apps pose security risks and may lead to restriction or ban. Do NOT claim third-party tools are approved or safe from account action. |
| WhatsApp Business Messaging Policy (last updated September 23, 2026) | https://whatsappbusiness.com/policy/ | Businesses need customer opt-in, must respect opt-outs, and avoid spam. |
| Meta pricing | https://whatsappbusiness.com/products/platform-pricing/ | Meta platform charges are not comparable to RelayWA session-subscription charges on a one-to-one basis; dynamic rates must always link to source rather than be hard-coded. |

## RelayWA source and scope checks

- Current `apps/api/src/messages/send-message.controller.ts` implements QR-session key-authorized `POST /send-message` and not the Meta Graph API. `docs/seo/batch-09-serp-intent-and-publishing-gates.md` documents tested messaging/country claims and pricing distinctions.
- The existing `/help` FAQ and `/pricing` page already explain the QR-linked model; the new help section adds *decision and risk* substance rather than a duplicate thin regional landing page.
- Clearly identify the unapproved model, warn about WhatsApp restrictions, describe official platform as the route where official authorization is required, reference source policy and client consent obligations.
- Do not claim any pricing, uptime, number of customers, Meta affiliation, source code equivalence, certification, country compliance, or absence of bans.

## Publishing status and outstanding Batch 11 gates

This is the **first incremental work** for Batch 11, not completion. The separate comparison article and WasenderAPI/vendor comparison are still drafts. Vendor claims should be explicitly confirmed against actual current vendor docs, e.g. https://www.wasenderapi.com/api-docs/webhooks and https://www.wasenderapi.com/api-docs/sessions ; any vendor pricing needs a separately verified current price source and a dated review. Refrain from `best`, `#1`, `cheapest`, review/rating markup or fake endorsements.

Complete legal and security review of public terms/contact/privacy, privacy-specific product facts, a mobile accessibility audit, canonical and sitemap protections, and evidence-backed editorial review before calling Batch 11 complete. Current changes do not interact with tenant, billing or WhatsApp session code and do not deploy to production.
