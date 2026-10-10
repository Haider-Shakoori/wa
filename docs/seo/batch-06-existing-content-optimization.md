# SEO Batch 06 — Improve existing English documentation and commercial intent

**Issue:** https://github.com/Haider-Shakoori/wa/issues/83  
**Language:** English only. **Product:** QR-linked WhatsApp Web session REST API, **not** the official Meta WhatsApp Cloud API.  
**Scope:** Existing published marketing routes; no duplicate feature URLs or extra language/country landing pages.  
**Release:** Changes require green CI, Lighthouse and an approved deployment. GitHub merge is not VPS deployment.

## Why no separate feature pages?
A repository audit confirmed that `/api-docs` already includes full sections for QR session lifecycle, authentication/API keys, message sending, signed webhook signatures, and direct dispatch/application retries. `/pricing` explains subscriptions, `/help` contains FAQ, and the homepage already introduces key features. Publishing five thin `/features/...` copies would risk overlapping intent with the existing reference, and `/features/message-queue` would be factually wrong because outbound sends are **immediate**, not an outbound Redis queue.

## Canonical user journeys
| Search / buyer question | Existing canonical page | Deep link |
|---|---|---|
| How can I call RelayWA's REST API? | `/api-docs` | `/api-docs#quickstart` |
| How does WhatsApp QR linking work? | `/api-docs` | `/api-docs#sessions` |
| What can I send? | `/api-docs` | `/api-docs#messages` |
| How do I verify webhook signatures? | `/api-docs` | `/api-docs#webhooks` |
| Does RelayWA automatically queue/retry sends? | `/api-docs` | `/api-docs#queue` |
| What is the price and trial model? | `/pricing` | `/pricing` |
| Where can I start a trial? | `/register` (private signup flow) | `/register` |

`#...` anchors are navigation within one SEO document, not independent indexable pages or sitemap entries.

## Implementation
- Shared `apps/web/lib/seo-topic-map.ts` defines a single audited five-topic-to-existing-anchor map and the canonical signup/pricing/docs destinations.
- Homepage adds a responsive, keyboard-accessible developer documentation grid with unique intent-focused explanations, real links and accurate QR Web session/Cloud API distinctions. Its existing feature presentation and workflows are retained.
- `/pricing` adds an explanatory section pointing to session, webhook and immediate-sending details. The dynamic plan cards and checkout/subscription logic remain unchanged. The hardcoded `Save 14%` annual claim is replaced by neutral `Annual billing` pending actual plan-rate verification.
- `/help` adds deep links to quickstart, QR session pairing and webhooks. FAQ covers the Meta Cloud API distinction and direct dispatch/no automatic outbound retries.
- `/api-docs` has an intent-specific H1, meaningful introductory copy, a short accessible in-document topic menu, an explicit link to canonical `/pricing`, and a `/register` trial CTA (instead of sending new trial seekers to login).
- Improve the existing registry's unique docs and help metadata; **no new indexable URLs**, `hreflang` variants, locale redirects or false structured-data claims.
- Remove the public footer's explicitly fabricated `123 Example Street` placeholder address, preserving the existing support email and social links. A verified business address can be added later after approval.
- New styles respect existing site visuals, keyboard focus and 44px touch targets.

## Test and review gates
- `apps/web/test/seo-existing-docs-cro.test.mjs`: every deep-link destination exists, no new feature URL or false queue claim, English-only semantics, working registration route references, honest platform positioning, canonical route metadata and opt-in analytics safety.
- `scripts/seo-perf-budget.mjs`: production Next.js HTTP 200 HTML for `/`, `/pricing`, `/api-docs`, `/help`; all deep links are visible in HTML, doc section IDs exist, and docs trial CTA leads to registration; existing sitemap/canonical/private noindex and compressed size budgets remain.
- Standard CI: typecheck, tests, build, production HTML/asset budget, Docker Compose, dependency audit.
- Mobile Lighthouse: two runs per page; inspect performance, accessibility and SEO warnings.
- Production browser smoke after deployment should click every homepage/pricing/help docs link, use keyboard navigation, confirm `#sessions`, `#webhooks` and `#queue` scroll to the correct article sections and test signup as an unauthenticated user.
- Google Search Console baseline, paid conversion attribution, live indexation and field Core Web Vitals require actual verified data. Do not invent measured improvement.

## Editorial future rule
An optional dedicated English landing page is only warranted when it answers a *substantially different* customer question from the developer reference, provides approved original useful content, has evidence of distinct SERP intent, and gets an independent canonical and reviewed claims. Default to improving `/api-docs` instead.
