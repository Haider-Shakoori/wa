# RelayWA Batch 10: distinct Python and .NET integration examples

**Scope:** Original English source code, repository CI, and unpublished editorial briefs. No translated routes, country pages, VPS deployment, or live messaging were performed.

## Python 3.11 — safe transactional event webhook

Source: `examples/relaywa-python-webhooks/relaywa_example.py`. The standard-library example sends one opt-in order-ready update through the actual `POST /api/send-message` REST contract using a **stable** `clientMessageId`; validates HTTPS, server-side Bearer key, international recipient and event ID; differentiates HTTP 409 rejection from a network timeout with an **uncertain** outcome. It also provides a small local HTTP webhook receiver to verify `HMAC-SHA256(timestamp + "." + raw_body)` with `hmac.compare_digest`, a 5-minute timestamp window, body-size caps, and no sensitive event logging.

```bash
python -m unittest discover -v -s examples/relaywa-python-webhooks -p 'test_*.py'
# Requires an HTTPS reverse proxy and an authentic webhook secret to serve:
# RELAYWA_WEBHOOK_SECRET=... python examples/relaywa-python-webhooks/relaywa_example.py
```

The receiver callback MUST be replaced with durable inbox storage (event `id` unique index), verified opt-in, background execution, and after-commit processing. The included console runner does not persist events. No real WhatsApp number or live webhook callback was used in the tests.

## .NET 8 — failure-aware order state send

Source: `examples/relaywa-dotnet-transactional/Program.cs`. Dependency-injected `HttpClient` makes a **single** Bearer-authenticated call to the same API, with deterministic order/event idempotency, explicit rejection on HTTP errors, and explicit uncertainty on transport failures or incomplete HTTP success responses. The example separately checks timestamped raw-byte signed webhooks using `CryptographicOperations.FixedTimeEquals`. It is server-side code, NOT for shipping API tokens inside distributed binaries.

```bash
dotnet build examples/relaywa-dotnet-transactional/RelayWaExample.csproj -c Release
dotnet run --project examples/relaywa-dotnet-transactional -c Release -- --self-test
```

The tests exercise deterministic `HttpMessageHandler` responses, rejected sends, unparseable successful responses, and valid/stale/tampered webhook samples without calling RelayWA production. Consuming ASP.NET dependency injection, database durable event storage, idempotent event processing and a public webhook endpoint remain app-specific engineering requirements.

## Publication and quality decisions

- Both topics remain **draft / not indexable** under `docs/seo/editorial-calendar.csv`, because named independent editorial approval has not been recorded and actual consuming-app/live worker operation is not verified.
- The source code is backed by explicit Python and .NET CI jobs in `.github/workflows/seo-python-dotnet-examples.yml`; their successful results must be reviewed before publishing.
- If approved later, supply a distinctive step-by-step English guide for each example, register exactly the approved slug in `publishedArticles` and `editorialPages`, extend the public SSR/canonical/structured-data sitemap checks and add links to the existing API docs. Do not publish two superficial variations of `/api-docs`.
- Current QR-linked session API is **not** Meta's official WhatsApp Cloud API, a Meta BSP product, or a guaranteed account-safe messaging service. RelayWA does not automatically retry outbound sends; a network timeout can have an uncertain outcome.

**Remaining Batch 10 blockers:** independent human article review; consuming app/Laravel functional testing; live, opted-in staging QR/session and worker transport smoke (separately, with permission and secrets); then approved release and production indexing verification.
