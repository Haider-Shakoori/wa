# Batch 10 — English developer tutorials (first delivery)

**Status:** Initial two tutorial pages and tested samples. **Batch 10 remains open** until the wider documentation/blog editorial scope is completed and real app integration smoke tests are available. No VPS deployment. No country or foreign-language pages.

## Published content (two approved articles)

| Live-after-deployment route | Unique problem covered | Example |
|---|---|---|
| `/blog/nodejs-whatsapp-api-send-webhooks` | Backend API send + HMAC webhooks, raw-body verification, unknown-send outcomes | [Node.js 20+ code](../../examples/relaywa-node-webhooks/server.mjs) |
| `/blog/laravel-whatsapp-api-order-notifications` | Order-triggered opt-in messages, stable idempotency key, HMAC receiver and durable-inbox guidance | [Laravel notifier](../../examples/relaywa-laravel/app/Services/RelayWaOrderNotifier.php), [webhook controller](../../examples/relaywa-laravel/app/Http/Controllers/RelayWaWebhookController.php) |

The public `/blog` index and two articles are server-rendered Next.js routes, with unique English titles/descriptions, canonical URLs, in-page navigation, actual code fragments, reading information, TechArticle and BreadcrumbList JSON-LD (no invented review stars), internal links and footer/header discovery. Only these explicit approved paths enter the indexability allowlist/sitemap/GA4 public-only measurement rules. Draft article URLs return 404 and remain nonindexable. No foreign-language text added for keyword targeting.

## Verified API contract and guardrails

Read from actual NestJS `apps/api/src/messages/send-message.controller.ts`, `messages.dto.ts`, `messages.service.ts` and published `/api-docs` before drafting:
- `POST https://relaywa.com/api/send-message`; server-side session-bound Bearer key; payload `to`, `text`, optional **stable** `clientMessageId`.
- Backend returns `{success:true,data:<message record>}`. A successful HTTP response does **not** prove recipient delivery or read.
- `scheduledAt`, `priority` and `maxAttempts` are **rejected** by current backend despite their DTO legacy shape. Outbound dispatch is immediate, not a Redis queue. Application must manage scheduling and retries.
- On worker timeout or 503, sending may already be underway. Look up status using returned message ID where available; do not blindly generate a new idempotency key and resend.
- Webhook signature scheme documented by RelayWA: `x-relaywa-signature: sha256=<hex>` for HMAC-SHA256 of `timestamp + "." + exact raw HTTP body`; enforce timing-safe comparisons and a timestamp window; store event ID durably before processing to guard duplicate callbacks.
- QR-linked WhatsApp Web messaging is **not** Meta's official Cloud API; customers must opt in, and account/platform policy and reliability risks must be disclosed.

## Validation

- `apps/web/test/seo-developer-articles.test.mjs` tests the **actual Node example module**, mocked send success/rejection/network uncertainty, HMAC raw-body signature, tampered JSON, stale timestamp, invalid signature, and a sample webhook endpoint (fixtures only; no live WhatsApp connection or public webhook).
- Source assertions check PHP examples use Laravel Http::withToken, stable IDs, raw body verification before JSON parsing, and never represent Cache::add as durable production deduplication.
- `.github/workflows/seo-php-examples.yml` runs **PHP 8.3 syntax only**, not full Laravel feature tests. Laravel project wiring, database inbox table, transactional job, Http::fake tests, and a real session smoke test require an actual consuming Laravel app and separate validation.
- CI checks Next.js typecheck, tests, build, server-rendered HTML, sitemap, article structured data, mobile Lighthouse and compressed asset budget. External runtime behavior and Google indexing cannot be established by CI.

## Further original articles (not yet published)

1. Python or .NET integration workflow only if it offers genuinely new value beyond `/api-docs`.
2. QR-session troubleshooting from actual worker-state enumeration and reconnection tests, after verifying product and connection semantics.
3. Official Meta Cloud API vs QR-session policy comparison with dated, directly cited official Meta documentation and current practical limitations (Batch 11).
4. Vendor comparison after verifying current features, pricing and plan conditions (Batch 11), not generic "best API" boilerplate.
5. Blog publishing workflow: editorial checks, valid sources, copy review, maintenance calendar, SEO/CWV follow-up and production indexation validation.

## Editorial requirements

The initial articles are attributed to **RelayWA Engineering** as an organization description; no individual credentials or personal biography is fabricated. Before changing content update `verifiedAt`, source examples and relevant API contract tests. Publish only after checking real API endpoints and code; omit unverified testimonials, false claims about Meta authorization or ban-proof messaging. Keep the existing `/api-docs` as canonical endpoint reference, not reproduced duplicates.
