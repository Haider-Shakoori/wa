# RelayWA SEO Batch 10 — Editorial publishing gates and maintenance calendar

**Date:** 2026-10-11  
**Language:** English only. **Product:** independently operated QR-linked WhatsApp Web session API (not official Meta Cloud API).  
**Machine-readable calendar:** [editorial-calendar.csv](editorial-calendar.csv) tracks keyword, locale, attribution, reviewer status, code-check date, internal link target, source and publication gate.  
**Approval status:** Existing developer articles are already published in the GitHub code and were source-checked using tests, but there is **no recorded named human editorial sign-off**. The calendar explicitly says so; do not manufacture an individual reviewer or misleading official credentials.

## Article publication checklist

1. Select a search need not already answered comprehensively in the canonical `/api-docs`. A blog post must solve an actual end-to-end problem (order state, failure classification, signed events, diagnostics) rather than restating endpoint tables or replicating one page for every country.
2. Verify exact DTO fields, URL aliases, response wrapper, authentication, scopes, runtime statuses, duplicate-message semantics, deployment architecture and failure messages against current `apps/api`, worker implementation and existing tests; reference exact code paths and which claims were not live-tested.
3. Produce complete, original **English** content with a primary keyword, compelling problem statement, business prerequisites, code or safe read-only diagnostic, expected API behavior, limitations, opt-in and account/Meta-affiliation disclosure. Require useful instructions and not keyword-stuffed filler.
4. Attach a locally or CI-executed example with deterministic mocks, including negative cases for invalid auth, stale webhook signatures, missing sessions and uncertain send outcomes. A syntax-only lint does not qualify as full Laravel or .NET integration proof.
5. Name an accountable human editorial reviewer before calling independent review complete. Record review outcome and date in the calendar; record author identity honestly. If no reviewer record exists, keep `editorial_reviewer = not recorded` and do not claim human approval.
6. Add the **published** article to the typed `publishedArticles` collection, published editorial route registry and sitemap only after the review and code verification; maintain a stable slug, a unique canonical/description, accurate `publishedAt` and `verifiedAt`, TechArticle/BreadcrumbList schema, outbound security-safe references, and at least one meaningful internal docs link.
7. Keep future drafts in the calendar with `status=draft` and no article registry entry, new indexable URL, sitemap entry, fake hreflang or translated SEO block. Drafts must resolve to 404/noindex. Do not set `status=published` just to satisfy a content-count KPI.
8. Verify server-rendered HTML, accessibility, linked source location, technical tests, reduced motion/mobile layout, sitemap/robots, and full GitHub CI. After **separate** VPS deployment, verify real production canonicals, page indexation (Search Console), conversion attribution and performance. These checks are different from local and GitHub CI tests.
9. Quarterly or when the API contract changes, re-check each published code example and update its `verifiedAt` and calendar row; unpublish or correct stale misleading instructions. Avoid changing publication date just to appear fresh.

## Current release ledger (source-checked; reviewer not recorded)

| Status | Article / primary keyword | Contract-backed value | Known validation gap |
|---|---|---|---|
| Published-in-GitHub | Node.js API and signed webhooks / `whatsapp api nodejs` | Mock HTTP send, idempotency and raw-body HMAC fixture tests | No live WhatsApp or HTTPS webhook deployment test |
| Published-in-GitHub | Laravel order notifications / `whatsapp api laravel` | Laravel 11/12 service and HMAC controller, PHP 8.3 syntax check | Not embedded in a real customer Laravel app; no DB inbox/queue tests |
| Published-in-GitHub | QR connection troubleshooting / `whatsapp api qr code` | Nine actual statuses from `session-status.ts`, real read-only endpoints and mocked QR expiry/privacy tests | No live pairing and worker-infrastructure smoke test |
| Draft | Python / `whatsapp api python` | Intended distinct workflow | Requires meaningful functionality not already in `/api-docs`; tested implementation and review |
| Draft | .NET / `whatsapp api c#` | Intended distinct workflow | Requires tested .NET HTTP/webhook integration and review |
| Draft | Official vs QR-linked comparisons | Distinguish authorization, risks and fee models | Batch 11: dated primary Meta documentation and independent factual verification |
| Draft | Provider comparisons | Help qualified customers evaluate alternatives | Batch 11: dated vendor facts, current pricing, neutral language |

## QR-session troubleshooting — API source audit

Confirmed against actual `apps/api/src/sessions/session-status.ts`, `sessions.controller.ts`, `sessions.service.ts`, `qr.service.ts`, `events.service.ts`, plus messages service and public docs:

- Session status set: `pending`, `need_scan`, `connecting`, `connected`, `disconnected`, `reconnecting`, `logged_out`, `expired`, `error`.
- Read-only endpoints: `GET /api/whatsapp-sessions/:sessionId`, `GET /api/whatsapp-sessions/:sessionId/qrcode`, `GET /api/whatsapp-sessions/:sessionId/logs`, and `GET /api/whatsapp-sessions/:sessionId/events` (SSE). These require permission and organization access. The QR response contains `available`, `status`, `expiresAt`, and when fresh can contain sensitive `qr` and `dataUrl`.
- Commands `POST .../connect`, `.../restart` or `.../disconnect` are **queued** commands; the response `status='queued'` does NOT mean transport connected. Never suggest automatic logout/restart loops. Session deletion is restricted to pending/logged_out and requires no in-flight command.
- Outbound `send-message` is immediate and not an auto-retrying queue. Session `connected` is necessary but not sufficient for subscription/auth/scopes/delivery; unknown send outcomes must be checked for duplicate safety.
- Diagnostics never print raw QR, QR image data, Bearer key or raw worker error; access the QR only through an authorized workspace view.

## Roadmap

This is a substantive partial Batch 10 implementation, but not completion of the full Batch 10 issue #87. Unfinished: Python and .NET **original** end-to-end recipes with appropriate test harnesses, real consuming-app/runtime smoke tests, independent editorial signoff, and comprehensive production SEO validation (requires separate deployment). Batch 09 remains held for regional buyer evidence; Batch 11 provider/policy comparisons are separate.

**No VPS deployment performed by this research/code delivery.**
