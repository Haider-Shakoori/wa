# SEO Batch 07 — Existing Framework Integration Docs and Example QA

**Decision (11 October 2026):** Keep the English `/api-docs` as the single indexable API integration reference. Do not create copied SEO pages for every programming language. Source of truth: issue [#84](https://github.com/Haider-Shakoori/wa/issues/84).

## Audit
- `apps/web/lib/integration-examples.ts` already included JavaScript, TypeScript, Python, PHP/Guzzle, Laravel, C#/.NET, Java, cURL, Ruby, Go, Swift, PowerShell, Rust and a text **n8n HTTP Request** recipe. These are examples, **not** official, supported SDKs or verified deployable third-party packages.
- `apps/web/app/docs/page.tsx` displayed a select set of language tabs and a client-side `CodeShowcase`; only the active example was visible in initial rendered HTML. No individually linkable, content-bearing framework sections existed.
- Some snippet templates used relative `/api` for external processes. That only works within a browser on the same origin; requests, Guzzle and cURL must call a fully qualified HTTPS URL.
- Homepage Node.js, Laravel, Python and n8n integration links pointed to `/api-docs` instead of the relevant snippets.

## Code delivered in this batch
- `lib/integration-guides.ts`: typed English framework-intent descriptions with stable anchors and framework-specific requirements, webhook guidance and product limitations.
- `/api-docs`: sections `#integration-nodejs`, `#integration-laravel`, `#integration-python`, `#integration-dotnet` and `#integration-n8n` with in-page navigation, visible headings, actual existing code samples and cross-links to `#quickstart`, `#webhooks` and `#queue`. Contents render as HTML from the Next.js app, not just in a hidden code tab.
- `lib/integration-examples.ts`: sample API base uses public `NEXT_PUBLIC_SITE_URL` or `https://relaywa.com`, normalized to origin + `/api`. Browser API client `lib/api.ts` is unchanged. JavaScript/Python samples check HTTP failures, Guzzle sample uses a Guzzle-compatible response body decoder.
- `components/marketing-sections.tsx`: existing homepage platform cards now deep-link to the corresponding published framework section. `CodeShowcase` quickstart deep-links correctly and displays file labels for all offered example languages.
- n8n is documented explicitly as a **manual HTTP Request node recipe**, not an official RelayWA connector or tested importable workflow.
- **No new sitemap routes, country pages, language variants, private analytics changes or auth/subscription changes.**

## Validation and what tests do NOT prove
- `apps/web/test/seo-integration-guides.test.mjs` verifies stable anchors, available examples, security placeholders, absolute URLs and Laravel/Guzzle distinctions. The JavaScript example is actually executed against a mocked HTTP `fetch` fixture, checking JSON, headers, path, and error handling. Python/PHP/.NET/n8n example text receives **static contract checks** only — this does not establish that a live integration works.
- Production Next.js `scripts/seo-perf-budget.mjs` checks that all five framework anchors, public absolute API sample URL, and homepage links appear in SSR HTML. It also checks fake `/integrations/laravel`, `/integrations/python`, and `/integrations/n8n` pages remain 404/noindex.
- GitHub standard CI must pass TypeScript, all tests, build, public-route smoke, compressed asset budgets, Compose and audit.
- Mobile Lighthouse reports performance/SEO/accessibility for `/`, `/pricing`, `/api-docs`, `/help` (two lab runs each). No field Core Web Vitals or SEO ranking impact claimed.
- Browser check after deployment: try framework links from homepage and docs navigation, copy sample code, verify HTTPS API URL, test message and webhook flows with an authorized test account. Obtain actual signup/conversion and Search Console data separately.

## Security/product guardrails
Use authorized opt-in messaging only. API keys are server-side; do not embed raw tokens in public frontends or examples. RelayWA connects QR-linked WhatsApp Web sessions, **not** Meta's official Cloud API/BSP service. Sending is immediate, without a built-in outbound Redis queue or automatic send retries. Scheduling and pacing are the integrator's responsibility; delivery acceptance is not guaranteed recipient delivery. Webhook handlers must verify the raw-body HMAC and HTTPS.
