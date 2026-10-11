# RelayWA — Everything Completed So Far

> **Project status record | Updated 12 October 2026**
>
> Repository: [`Haider-Shakoori/wa`](https://github.com/Haider-Shakoori/wa)  
> Work branch: [`feat/cpanel-hosting-package`](https://github.com/Haider-Shakoori/wa/tree/feat/cpanel-hosting-package)  
> Tracking PR: [#120 — cPanel hosting package](https://github.com/Haider-Shakoori/wa/pull/120) (**open, draft, not merged**)  
> Live site: [https://relaywa.com](https://relaywa.com)
>
> **Scope:** This file records the RelayWA website/SaaS and its October 2026 migration, performance, Cloudflare, Google tag and GitHub work discussed and verified so far. It is **not** a secrets backup or a claim that every user-facing integration has been tested. "Working" indicates the particular checks named below; "pending" means it has not yet passed end-to-end verification.

## RelayWA's purpose and functional scope

> **What RelayWA is:** A hosted, developer-oriented, multi-tenant WhatsApp integration SaaS. It allows a customer to connect an existing WhatsApp number with a WhatsApp Web QR-linked session, expose that connection to the customer's own application through authenticated REST API endpoints, and receive inbound messaging and connection events through webhooks. Customers manage numbers, credentials, subscriptions and activity in a web workspace. RelayWA operators manage the multi-tenant platform from a separate control plane.
>
> **Fundamental product distinction:** RelayWA is **not** Meta's official WhatsApp Cloud API and is **not** an official Meta Business Solution Provider. It uses linked-device WhatsApp Web sessions, principally through the Baileys engine. Platform rules, session disconnections and account restrictions are real risks; a paid subscription does not guarantee unrestricted delivery or account safety.

### Product mission and the problem it solves

RelayWA's intended purpose is to give developers and businesses a repeatable way to add WhatsApp messaging to software they already operate **without building their own device-linking, session management and inbound-webhook infrastructure from scratch**. Users can connect one or more WhatsApp accounts, select an appropriate subscription, issue an API key, call the API from their preferred programming language, and build their own customer-facing workflow around the resulting events.

The product is a **messaging connection layer**, not a complete CRM, mass marketing suite or fully autonomous customer-support agent. It handles the bridge to a linked WhatsApp account; the customer's application remains responsible for when and why it sends messages, consent and recipient eligibility, business logic, scheduling, conversation routing, and appropriately bounded client retries.

**Intended users:** software developers; SaaS founders; agencies integrating WhatsApp into client applications; businesses integrating order/status updates, appointment notifications and support replies into existing backends; technical teams connecting CRM, ERP, POS, e-commerce, helpdesk or automation platforms. The REST interface is language-agnostic; product documentation includes JavaScript/Node.js, Laravel/PHP, Python, C#/.NET, cURL and n8n HTTP request examples.

### How a customer uses the platform

1. **Discover and register:** Visit the public website, review features/pricing/API documentation and create an account (email/password, or supported Google/GitHub sign-in when the corresponding provider is configured).
2. **Get a tenant workspace and trial/plan:** Registration associates the user with an organization/workspace. The source includes trial and subscription provisioning; the public website advertises a **7-day no-card trial with one number and a daily message allowance**. Limits and prices must be checked against the actual server plan rows, not copied from static marketing claims.
3. **Link a WhatsApp number:** In **Sessions**, create a session, request a QR code, then scan it on the phone under WhatsApp **Linked devices**. The session runtime attempts to establish the link and exposes connection state, QR expiry and logs. Multiple accounts remain independent and count against the subscription's connected-session entitlement.
4. **Issue an API credential:** In **API access**, create an organization management key or session-bound key, choose only required permission scopes, copy it once, then store it on the customer's own backend. Keys can be listed and revoked; session-bound keys prevent unrelated apps from using the wrong WhatsApp number.
5. **Send a message:** The customer's server makes a bearer-authenticated REST request with the session, recipient and message payload. RelayWA validates permissions/plan limits and forwards the request through the API-to-worker transport to the linked WhatsApp session. It records message state for inspection. The platform includes a quick-send playground for authorized users.
6. **Receive incoming events:** Configure an HTTPS webhook endpoint, select event types and securely store the webhook signing secret. RelayWA forwards eligible message/session events to the external application, allowing the customer's software to update its own orders, tickets, contacts or conversations.
7. **Operate and pay:** Inspect connection status, recent message activity, webhook deliveries and account usage. Change subscription, view payment records and invoices and manage authorized billing options as configured.

These steps describe **implemented application flows in code and UI**, not proof that every step has passed a real cross-host/WhatsApp live transaction after the move to cPanel. See the acceptance checklist later in this file.

### Functional module inventory

The following inventory was cross-checked against the actual Next.js workspace/admin components, NestJS modules/controllers and API documentation on the active GitHub feature branch. **"Code/UI present" means developed and represented in the repository; it is not automatically a production end-to-end sign-off.**

| Module | Purpose and functionality | Status / caveat |
| --- | --- | --- |
| Public marketing website | Home, features, use cases, how-it-works content, pricing, free-trial CTA, developer guides/blog and help center | Public website live; individual conversion paths not all end-to-end tested |
| Developer documentation | API quickstart, endpoint reference, scoped authentication, session/QR connection, media, actions, webhooks, errors and production guidance; multi-language snippets | Published route `/api-docs` and code present |
| User registration and authentication | Email/password registration and login; configurable Google and GitHub login; session and token management; adaptive login protection | Controllers and UI present; real provider sign-in still requires acceptance tests |
| Multi-tenant organizations | Organization/workspace ownership and isolation; users and account context | Server modules and tenant-aware queries present; cross-tenant authorization regression/security testing remains important |
| Tenant dashboard | Subscription overview, connected numbers, recent usage, navigation and setup guidance | Workspace UI present; authenticated journey not fully accepted after migration |
| WhatsApp sessions | Add/list/rename/remove number sessions; connect, restart, disconnect/logout; view QR, status, errors and logs; session events stream | API/controller + UI present; actual QR pairing and persistence still must be live-tested |
| Messaging REST API | Send text, image, video, audio, document, reply, reaction, location, contact and poll; query message lists/status | Endpoint handlers present; success through the real VPS worker remains to be accepted |
| Quick-send testing | Workspace playground for choosing a connected number, entering recipient/message and sending text or uploaded media | UI wired to API; real delivery test pending |
| Contacts, chats and groups | Read synchronized WhatsApp directory information for a session through scoped endpoints | API endpoints present; contents depend on linked worker/session availability |
| API key management | Organization-level and session-bound credentials, token scopes and revocation | API and workspace UI present |
| Webhooks | Create/edit/delete endpoints, select events, provision signing secrets and inspect delivery attempts/errors | API + UI present; signed delivery/retry process requires live acceptance |
| Subscription entitlements | Trial, active/past-due/paused/canceled state, session and message limits, API key quotas, monthly vs annual billing | Source logic present; current commercial terms come from active production plans |
| Payments and invoices | Stripe checkout/portal/webhook integration; payment history and invoices; configured manual/demo paths and provider administration | Modules present; **real live Stripe checkout/webhook** is not yet verified |
| Tenant operations | Session status, message activity/history, webhook administration, settings and billing | UI/code present; hosted application must be checked with a tenant account |
| Platform control plane | Separate role-checked operator dashboard: tenants/members, sessions, messaging, subscriptions/pricing, payments/providers, worker/queue health, monitoring, logs, administrators and diagnostics | Code/UI present with roles; no unrestricted public access |
| Platform security | Admin roles (super, billing, support, read-only), configurable OAuth providers, MFA setup/recovery, login/security events, audit trails and session revocation | Role guards/endpoints present; security acceptance remains ongoing |
| Operational safeguards | Messaging pacing/rate controls, duplicate prevention windows, retry/failure-pause settings, worker diagnostics and message-storage configuration | Configuration/service code present; check runtime behavior per engine |
| First-party website traffic | Internal traffic/bot metrics and SEO conversion reports separate from Google Analytics | Platform modules present; different methodology from GA4 |
| Google Analytics 4 | Client-side public-page tag and conversion events; server-side reporting views for audience, channels, devices, pages and realtime | **Public GA4 data confirmed**; **platform GA4 reporting credential still missing on cPanel** |
| SaaS onboarding | Source includes plan selection, payment/workspace/link/API key/test/webhook steps, plus a lightweight workspace checklist | Implemented in source; **current registration/redirect policy must be checked** against the desired no-forced-onboarding behavior |

### The two separate interfaces

**Customer workspace (tenant-facing):** `/dashboard` and the related **Sessions**, **Subscription**, and **API access** screens. Intended for customers to link their own numbers, access a session, manage credentials, send test messages, inspect webhook delivery and pay for their plan. A tenant's identity and subscription permissions must not grant access to platform administration.

**RelayWA control plane (platform operator):** a separate admin UI under `/platform`, requiring a valid JWT and the platform administrator guard. Its navigation groups include **Operations** (overview, clients, sessions, messaging), **Commercial** (website subscriptions, subscriptions, payments, providers), and **System** (monitoring, website traffic, Google Analytics, analytics, audit/security, administrators, infrastructure, authentication, storage and diagnostics). The code distinguishes `super_admin`, `billing_admin`, `support_admin` and `read_only` roles. This console is for managing RelayWA as a SaaS product, not for an ordinary tenant to control other accounts.

### WhatsApp integration: technology and lifecycle

- **Underlying integration:** QR-linked WhatsApp Web sessions, with **Baileys** as the default worker messaging engine. The control plane also contains **Chromium engine selection/configuration**; its availability and real-life reliability must be verified rather than assumed.
- **Isolation:** Each WhatsApp number has its own session state. Independent session/API credentials are intended to reduce accidental mixing of customer numbers and tenants.
- **Pairing:** Link an existing WhatsApp account through a phone-scanned QR code. Connection updates, re-pairing after logout, reconnect/restart operations and session logs are represented in the source.
- **Workers:** Separate messaging processes on the VPS handle account connectivity and interaction with WhatsApp. The cPanel API sends commands through the private worker dispatch tunnel; the web application does not host Chromium/Baileys processes.
- **Events:** Session/event endpoints include server-sent events (SSE); configured webhook endpoints deliver incoming messages/session activity to the customer's own HTTPS server.
- **Client retries:** Product docs explicitly distinguish **direct outbound sending** from webhook delivery retries. Customers control scheduling and bounded retries for outbound API sends; use a stable `clientMessageId` for deduplication. Do **not** market an automatic outbound retry queue or guaranteed delivery as a completed feature.
- **Safety:** Anti-spam rules, throttling, account status and WhatsApp's own restrictions still apply. RelayWA cannot guarantee account immunity from bans, limitless throughput or authorization from Meta.

### Messaging formats and example workflows

**Implemented API message/action categories:** text; images; videos; audio/voice messages; documents; replies; reactions; locations; contact cards; polls. There are also read endpoints for message records and synchronized contacts/chats/groups.

**Example third-party applications** (these are **use cases customers can build**, not fully implemented built-in vertical products):

| Example | What the customer's system does with RelayWA |
| --- | --- |
| E-commerce | Sends paid-order confirmations and dispatch/delivery notifications from its order management backend |
| Booking/appointment system | Sends appointment reminders and processes replies in the booking workflow |
| CRM or support desk | Sends support responses and receives inbound-message webhooks to update tickets |
| POS/ERP | Sends receipts, collection reminders or status updates from its own business logic |
| AI assistant / n8n | Feeds signed incoming webhook events into an external workflow with review/escalation safeguards |
| Logistics/field service | Sends status or location messages from its own application |

RelayWA itself does **not** become a complete CRM, ticket system, AI chatbot, OTP verification network, payment gateway or multi-channel omnichannel inbox merely by connecting to those services.

### Subscription and commercial model

- The site advertises a **free 7-day trial**, no card requirement, one linked number and a daily trial usage allowance; verify actual limits against active database plans before promising a number.
- Paid subscription packages are **based on connected sessions/numbers and billing interval**, not a per-message charge in RelayWA's advertised commercial model. Application-level messaging safety and WhatsApp policy still apply regardless of plan.
- Public plan cards are fetched from `/api/public/plans`, rather than treating hard-coded marketing copy as the single source of truth.
- Code includes monthly/annual purchase selection, subscription status/allowances, payment history, invoice generation, Stripe checkout and billing portal integration, plus operator-configurable billing providers/manual paths.
- The platform operator can manage tenant subscriptions and the website's advertised plan prices. This capability was the subject of a separate subscription-editing fix and requires real acceptance testing.
- Before declaring billing production-ready, test the actual provider mode, webhook signatures, retries/idempotency, subscription activation and cancellation with an approved account.

### API structure at a glance

These are representative **source-implemented route families**. All application URLs use RelayWA's `/api` gateway and relevant authentication/permission guards; most endpoints also have `v1` aliases.

| Route family (after `/api`) | Role |
| --- | --- |
| `/auth/*` | Signup/sign-in, OAuth, MFA and user session security |
| `/whatsapp-sessions/*` | WhatsApp session management, QR, connection events and logs |
| `/whatsapp-sessions/:sessionId/messages/*` | Send/read messages and message actions, including media uploads |
| `/whatsapp-sessions/:sessionId/contacts`, `/chats`, `/groups` | Session directory reads |
| `/api-keys/*` | Scoped organization and session API key lifecycle |
| `/webhooks/*` | Manage event subscriptions and inspect attempts |
| `/billing/*`, `/public/plans` | Pricing, checkout, invoices, subscriptions and providers |
| `/platform/*` | Restricted operator/admin management and reports |
| `/onboarding/*` | Recorded tenant setup state and workflow steps |
| `/health` | Public API health response |

For payload shapes, authentication schemes and up-to-date permissions see [the public API documentation](https://relaywa.com/api-docs) and the corresponding controller/service code, not this summary.

### Current functional boundaries and unimplemented proposals

- **Not the official Meta API:** This is a QR-linked WhatsApp Web bridge, not Meta's Cloud API, approved business messaging provider, or a guarantee that every account can send messages.
- **Not an OTP feature release:** WhatsApp-initiated verification and OTP delivery were explored as product ideas; there is **no confirmation they were implemented or released**. Do not list them as shipped.
- **Not an autonomous mass-sending suite:** Campaign blast/scheduling, built-in AI replies, automatic lead nurturing and similar commercial ideas should be tracked as separate scoped features if required, rather than implied by current endpoints.
- **Not a managed outbound scheduler:** The API documents direct outbound sends; clients implement their own timing, policy compliance and retry management.
- **Not a live GA4 reporting integration yet:** The public Google tag records visits; cPanel service-account credentials for the private operator dashboard are still missing.
- **Not end-to-end verified just because the API has controllers:** The implementation inventory is source-backed, but real QR linking, outbound/inbound WhatsApp operations, Stripe production payment, email delivery and authenticated tenant journeys still require acceptance testing as described below.

### Product-related sources in this repository

- Public marketing product description and FAQ: [`apps/web/components/relay-home.tsx`](apps/web/components/relay-home.tsx)
- Customer-facing sessions, subscriptions and API access: [`apps/web/components/relay-workspace.tsx`](apps/web/components/relay-workspace.tsx)
- Detailed quickstart, message types, safety notes and endpoints: [`apps/web/app/docs/page.tsx`](apps/web/app/docs/page.tsx)
- REST controllers: [`apps/api/src/sessions/sessions.controller.ts`](apps/api/src/sessions/sessions.controller.ts), [`apps/api/src/messages/messages.controller.ts`](apps/api/src/messages/messages.controller.ts), [`apps/api/src/webhooks/webhooks.controller.ts`](apps/api/src/webhooks/webhooks.controller.ts)
- Multi-tenant and platform control plane: [`apps/web/app/platform/page.tsx`](apps/web/app/platform/page.tsx), [`apps/api/src/platform/platform-admin.controller.ts`](apps/api/src/platform/platform-admin.controller.ts)
- Subscription and payments: [`apps/api/src/subscriptions/subscriptions.service.ts`](apps/api/src/subscriptions/subscriptions.service.ts), [`apps/api/src/payments/payments.controller.ts`](apps/api/src/payments/payments.controller.ts)
- Production deployment and acceptance: [`docs/cpanel-migration.md`](docs/cpanel-migration.md)

---

## 1. Current high-level status

| Area | Status | What is known |
| --- | --- | --- |
| RelayWA public website | **Live** | The production website loads from cPanel and was observed returning HTTP 200 through the Cloudflare proxy and directly from cPanel. |
| RelayWA NestJS API | **Live, partial acceptance** | `/api/health`, public plans and OAuth-provider configuration returned HTTP 200; the protected unauthenticated endpoint correctly rejected access. Actual login/WhatsApp flows still need acceptance tests. |
| Cloudflare Free | **Active** | Domain delegated to Cloudflare; Free plan, Full (strict) SSL, HTTPS redirect, HTTP/2, compressed content and static asset caching verified. HTTP/3 advertised, not independently negotiated in a client test. |
| PostgreSQL / Redis / WhatsApp | **Stay on VPS** | Existing database, cache, queues, workers, QR credentials and session storage were deliberately **not migrated** to cPanel. |
| cPanel email | **DNS and connectivity checked** | Mail/MX/SPF/DKIM/DMARC records preserved; SMTP/IMAP ports reachable. Actual mailbox send/receive acceptance still pending. |
| Public Google Analytics tag | **Recording data** | GA4 property reports site page views, sessions and marketing CTA events. |
| RelayWA internal GA4 dashboard | **Not configured** | The cPanel API lacks its private Google service-account credential path and property permission. |
| GitHub configuration sync | **Pushed on feature branch** | Docs, Cloudflare snapshot, security ignores and dashboard hint were committed; six GitHub workflows passed at previous snapshot `fa20f0d`. |
| Merge to `main` | **Held deliberately** | PR #120 remains draft until legacy VPS deployment triggers, release differences and operational acceptance are reviewed. |

### The most important non-negotiable requirement

**Only the website (Next.js), its SaaS/admin UI and the backend API (NestJS) belong on cPanel. Everything else—PostgreSQL, Redis, WhatsApp/Baileys workers, messaging queues, QR/session state and related VPS services—must stay on the original VPS.** There must be no automatic PostgreSQL-to-MySQL conversion, loss of the original worker sessions, or wholesale VPS shutdown.

## 2. Production architecture and hosts

```text
Visitors (browser / customer)
          |
          | HTTPS, HTTP/2; Cloudflare also advertises HTTP/3
          v
     Cloudflare FREE
      relaywa.com
          |
          | HTTPS (Full strict)
          v
    cPanel / CloudLinux
    IP: 51.81.56.231
       |          |
       |          +-- Next.js website, marketing pages, login and admin UI
       +------------- NestJS API mounted at /api
       +------------- cPanel email (separate DNS-only mail hostname)
          |
          | private VPS-initiated SSH reverse tunnel
          v
      Existing VPS
    PostgreSQL / Redis / WhatsApp/Baileys workers / QR sessions
    Original VPS public IP: 108.165.233.125
```

- **Frontend:** Next.js, standalone production package; CloudLinux Node.js 22 with Passenger. Public app root: `/home/relaywa/apps/relaywa-web-production/apps/web`.
- **Backend:** NestJS, separate Node.js 22 Passenger application rooted at `/home/relaywa/apps/relaywa-api-production`, exposed at the same-origin `/api` path.
- **Private runtime config:** Located outside `public_html` under `/home/relaywa/.relaywa-private/`. Environment files have owner-only access; no live secrets belong in Git.
- **VPS:** Its services and persistent state stay in place. The old VPS website/API containers were intentionally retained temporarily for rollback and outdated DNS caches. Do not retire them without operational review.
- **Staging:** `staging.relaywa.com` and `api-staging.relaywa.com` point to cPanel and are DNS-only.
- **Email:** `mail.relaywa.com` points directly to cPanel, not through Cloudflare's HTTP reverse proxy.

## 3. Migration and cPanel deployment — completed

- [x] Identified the existing `wa` GitHub repository and established an isolated cPanel hosting branch/PR, rather than creating a separate replacement project.
- [x] Connected to the cPanel host using SSH and audited CloudLinux, Node.js Selector, Passenger, Node versions and the initial hosting directories.
- [x] Prepared **separate** build and deployment artifacts for the Next.js website and NestJS API; the artifacts intentionally exclude the WhatsApp worker, sessions and live database.
- [x] Configured Node.js 22 production apps under CloudLinux Passenger using the cPanel application entries and private runtime environment files.
- [x] Brought the new cPanel homepage, pricing, login, registration and same-origin `/api` routes online.
- [x] Verified direct-origin HTTPS/TLS and successful public endpoint responses.
- [x] Verified that the subscription-plan response from cPanel matched the old VPS's response exactly at the time of cutover, evidence that both used the same existing PostgreSQL data (not a newly seeded database).
- [x] Checked that an unauthenticated protected API endpoint returns HTTP 401.
- [x] Configured a **VPS-initiated** SSH reverse tunnel for PostgreSQL via a private Unix socket on cPanel and authenticated worker dispatch via a loopback-only port.
- [x] Fixed the watchdog's false-positive SSH process check; set up a once-per-minute scheduled tunnel watchdog. The code is tracked at [`deploy/vps/ensure-cpanel-tunnel.sh`](deploy/vps/ensure-cpanel-tunnel.sh).
- [x] Updated public website DNS to the cPanel origin before adding Cloudflare; kept the existing VPS services available during propagation.
- [x] Preserved the initial working web/API production releases and a website rollback copy from a subsequent performance deployment.
- [x] Added the reproducible cPanel bundle workflows and release helpers under `.github/workflows/` and `scripts/`.

**Private transport details (non-secret locations):** PostgreSQL is forwarded to the cPanel Unix socket under `/home/relaywa/.relaywa-staging/private/pg/`. Worker dispatch uses the cPanel loopback address and port `127.0.0.1:13002`. Do not open public database/Redis/worker ports to the internet. Redis stays on the VPS; its complete connectivity path should receive an additional production audit.

## 4. Cloudflare Free migration — completed

- [x] Opened a Cloudflare zone for `relaywa.com` on the **Free** plan and imported DNS.
- [x] Corrected imported DNS records that had incorrectly proxied mail and cPanel administration hosts.
- [x] Kept **only** the public website `relaywa.com` and `www` behind the Cloudflare orange-cloud proxy.
- [x] Preserved `mail`, service, and staging hosts as grey-cloud/DNS-only.
- [x] Added/verified the DNS-only `api-staging` A record.
- [x] Switched the Namecheap registrar delegation to Cloudflare's assigned nameservers:
  - `audrey.ns.cloudflare.com`
  - `mitch.ns.cloudflare.com`
- [x] Confirmed Cloudflare's zone status **Active** and Universal SSL **Active** for the website and wildcard, with displayed expiry **10 January 2027**.
- [x] Confirmed encryption mode **Full (strict)**, providing verified HTTPS both browser → Cloudflare and Cloudflare → cPanel.
- [x] Verified a redirect from HTTP to HTTPS, the website and API HTTP 200 through Cloudflare, and `www` canonical redirection.
- [x] Confirmed HTTP/2 from Cloudflare and an `alt-svc: h3` advertisement for HTTP/3. **An actual HTTP/3 client negotiation was not measured**, so do not state it was independently tested.
- [x] Confirmed Brotli for HTML and a Cloudflare `MISS` followed by a `HIT` for immutable versioned CSS.
- [x] Confirmed that dynamic pages and API requests were marked `cf-cache-status: DYNAMIC` instead of being served from the CDN cache.
- [x] Verified SPF, DKIM, DMARC and MX records through public resolvers, with `mail.relaywa.com` still resolving to `51.81.56.231`.

### DNS/proxy reference

| Name | Type / destination | Proxy |
| --- | --- | --- |
| `relaywa.com` | A → `51.81.56.231` | **Proxied** |
| `www` | CNAME → `relaywa.com` | **Proxied** |
| `mail` | A → `51.81.56.231` | DNS only |
| `@` MX | priority 0 → `mail.relaywa.com` | DNS only |
| `cpanel`, `cpcontacts`, `cpcalendars`, `ftp`, `webdisk`, `webmail`, `whm` | A → `51.81.56.231` | DNS only |
| `staging`, `api-staging` | A → `51.81.56.231` | DNS only |
| SPF, DKIM, DMARC | Existing TXT records | Preserve exactly |

The safe, **non-importable** DNS description is [`deploy/cloudflare/zone-config.example.json`](deploy/cloudflare/zone-config.example.json). That example is not a substitute for exporting the full authoritative zone.

**Never enable `Cache Everything` for login, authenticated dashboards, payments, Stripe webhooks, API calls or personalized HTML.** Cloudflare Free HTTP/2 and HTTP/3 do not require moving the app onto Cloudflare or subscribing to a paid Cloudflare plan.

## 5. Website performance and login optimization

### Changes committed to GitHub

- [x] Refactored the public homepage: static marketing content can be server-rendered, while navigational/interactive controls use small client components.
- [x] Removed an unnecessary **client-side** security-status round trip from normal login submission. The server-side CAPTCHA/risk validation remains authoritative; this is **not** a CAPTCHA bypass.
- [x] Deduplicated Google/GitHub sign-in provider configuration reads with a short-lived shared cache.
- [x] Prefetched dashboard navigation as the user begins to enter an email address.
- [x] Prevented stale login risk requests from applying to a changed email address.
- [x] Scoped repeat-visit caching to stable branding assets, without caching protected routes, sessions, or user-specific data.
- [x] Prepared local Inter Variable font preloading, preserving the site's typography, plus optimization/lazy loading of the route-change logo image.
- [x] Updated source-level pricing, SEO, performance and accessibility regression tests for the server/client component split.
- [x] Added CI Lighthouse auditing of the **live** `https://relaywa.com` URL, in addition to local build tests.

### Hosting-level changes verified live

- [x] Appended a guarded Apache `mod_deflate` configuration to cPanel; source is at [`deploy/cpanel/relaywa-compression.htaccess`](deploy/cpanel/relaywa-compression.htaccess).
- [x] Verified homepage HTML compression from about **173 KB transferred uncompressed** to **37 KB gzip** (roughly 79% smaller).
- [x] Verified sample login HTML reduced from **17.2 KB** to **4.3 KB** and CSS from **5.2 KB** to **1.3 KB** over gzip.
- [x] Verified cached immutable CSS and Brotli through Cloudflare Free.
- [x] Deployed an earlier **website-only** performance build to cPanel and preserved rollback at `/home/relaywa/apps/relaywa-web-preperf-d659b074`. The NestJS API and VPS runtime were left untouched by that web performance deployment.

**Release caution:** The later font-preload and route-loading-image fixes passed GitHub workflows, but have **not** been confirmed deployed to production. Green CI means *ready for reviewed release*, not *live*.

### Lighthouse evidence (different times / networks / conditions)

| Test/screenshot | Performance | Other scores / context |
| --- | ---: | --- |
| Initial user screenshot | **63** | FCP 3.1 s, LCP 3.1 s; Modern HTTP and render-blocking requests flagged |
| Following user screenshot | **61** | FCP 3.4 s, LCP 3.7 s; still HTTP/1.1 and render blocking |
| Later user screenshot after hosting optimizations | **97** | Accessibility 93; Best Practices 100; SEO 100 |
| Another user screenshot after Cloudflare transition | **89** | Accessibility 93; Best Practices 100; SEO 100; Modern HTTP and CSS delays still reported |
| GitHub automated audit against live production URL | **92–93** | FCP roughly 1.7–2.0 s, LCP roughly 2.9–3.0 s |

These scores are **not a controlled before/after average**; location, throttling, cache state, DNS propagation and time differ. Immediately after Cloudflare activation, the connected Windows machine and some DNS resolvers still reached cPanel directly via **HTTP/1.1**, while direct Cloudflare-edge testing negotiated **HTTP/2**. End users do **not** need to manually change DNS permanently; it propagates automatically.

### Remaining performance opportunities

- [ ] Repeat a comparable Lighthouse audit after Windows/local DNS has fully switched to Cloudflare.
- [ ] Examine remaining stylesheet/request-chain blocking, image-delivery savings, cache lifetime and legacy JS warnings if they persist.
- [ ] Compare production release hashes with the feature branch; deploy approved pending font/image changes via tested website-only build, then verify the live outcome.
- [ ] Measure login and authenticated dashboard timings with a permitted test account; HTTP status checks alone do not measure login UX.

## 6. Google tag, GA4 and RelayWA platform dashboard

### Public website GA4: **working**

- Measurement ID configured in the Next.js web tracker: **`G-61Z26DFM1V`**.
- Connected RelayWA GA4 property ID: **`558119248`**.
- The public tag uses Google's `gtag.js` after page hydration and the site's analytics policy check; its absence from the *initial server HTML* does **not** prove the tag is absent.
- It tracks selected public/indexable marketing pages and supported marketing actions. It does not intentionally track authenticated dashboard contents or private URLs.
- It preserves a previously recorded analytics refusal and the consent policy. Do not remove consent controls or bypass legal requirements for visitors in consent-required regions.
- Via the connected GA4 reporting source, data for **11 October 2026** showed:
  - **56 `page_view` events**: 47 for `/`, 7 for `/api-docs`, 2 for `/blog`;
  - **15 `session_start` events**;
  - **10 active users** in the queried page-view report context;
  - **6 `trial_cta_click`** and **4 `docs_cta_click`** events.
- These observations demonstrate reporting existed for that date; they are **not** proof that every later visit is recorded. Realtime verification is still useful.

### Google Analytics **inside** the RelayWA control plane: **pending**

The RelayWA internal Google Analytics admin screen correctly identifies that the **backend reporting service is missing private service-account configuration**. The report code exists in:

- `apps/api/src/platform/google-analytics-reporting.service.ts`
- `apps/web/components/platform-google-analytics.tsx`

The service requires `GA4_SERVICE_ACCOUNT_FILE` or `GOOGLE_APPLICATION_CREDENTIALS` pointing to an owner-only JSON service-account file **on the cPanel API server**, not on the VPS and not in GitHub. The expected service-account identity is:

`relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com`

Outstanding prerequisites:

- [ ] Authenticate to the correct Google Cloud project and confirm service account identity and Google Analytics Data API permissions.
- [ ] Grant this identity **Viewer** to GA4 property `558119248` using GA4 Property Access Management.
- [ ] Securely provision an approved credential on cPanel outside `public_html` (prefer keyless auth if implementation supports it; never commit JSON keys).
- [ ] Set private API environment to reference that credential and restart **only** the API Passenger app if needed.
- [ ] Verify the authorized endpoint `/api/platform/google-analytics?days=7` gives `status: ready`, then test 30/90-day views and realtime reporting.

The admin text was updated in GitHub to refer to the **cPanel API server** rather than an outdated Docker API container. **That updated UI wording is not automatically deployed to the live website.**

The local Windows machine was found to have **Google Cloud CLI installed**, but the last account/project inspection did not show a selected project or confirmed logged-in Google identity. Sign-in was initiated; completion was not verified.

Full procedure: [`docs/google-analytics-reporting.md`](docs/google-analytics-reporting.md).

## 7. GitHub repository, CI and deployment status

- Repository: **`Haider-Shakoori/wa`**.
- Feature branch: **`feat/cpanel-hosting-package`**.
- PR: **[#120](https://github.com/Haider-Shakoori/wa/pull/120)** — open/draft and **not merged**.
- The latest pre-summary configuration commit was **`fa20f0d15571b35f5b5f603de9b236dc185369fc`**.
- All **six** workflow runs associated with that commit succeeded:
  1. `CI`
  2. `cPanel production candidate`
  3. `cPanel staging bundles`
  4. `RelayWA live cPanel Lighthouse`
  5. `RelayWA Mobile Lighthouse`
  6. `RelayWA SEO Browser Preflight`

Previously added/updated sources and automation include:

| File / area | Purpose |
| --- | --- |
| `.github/workflows/cpanel-production-bundles.yml` | Build and test API/web candidate artifacts, excluding VPS-only workers |
| `.github/workflows/cpanel-bundles.yml` | Reproducible staging bundles |
| `.github/workflows/cpanel-live-lighthouse.yml` | Audit the public live URL from CI |
| `apps/api/passenger.js`, `apps/web/passenger.js` | Passenger-compatible application entry points |
| `apps/web/next.config.ts` | Same-origin `/api` and safe static branding caching |
| `scripts/build-cpanel-bundles.mjs` | Create cPanel deployment bundles |
| `scripts/provision-cpanel-env.mjs` | Write owner-only cPanel runtime env files on the server |
| `scripts/live-lighthouse-summary.mjs` | Analyze live Lighthouse results |
| `deploy/vps/ensure-cpanel-tunnel.sh` | VPS-initiated SSH tunnel health watchdog |
| `deploy/cpanel/relaywa-compression.htaccess` | Apache text compression |
| `deploy/cloudflare/zone-config.example.json` | Sanitized Cloudflare Free DNS and TLS reference |
| `docs/cpanel-migration.md` | Current deployment boundaries, DNS, rollback and acceptance |
| `docs/google-analytics-reporting.md` | Private GA4 backend report setup |
| `.gitignore` | Additional accidental credential-commit protection |
| `README.md` | Links to infrastructure/configuration documentation |

**Do not blindly merge PR #120.** A legacy `main` workflow might still deploy to the VPS. Review deployment triggers, promote tested cPanel builds intentionally, and keep the current rollback paths until authenticated and WhatsApp end-to-end acceptance has passed.

## 8. Security and privacy guardrails already applied

- [x] Production secrets are stored as private files outside `public_html` and not part of website/API build artifacts.
- [x] No raw private SSH key, GA4 JSON private key, Cloudflare API token, Stripe secret or live `.env` file was committed in the configuration sync.
- [x] Secret filename patterns were added to `.gitignore`; this prevents typical accidental adds but does **not** replace proper secret scanning or access control.
- [x] TLS certificate validation at the public origin and Cloudflare edge was checked.
- [x] Sensitive API routes have authenticated platform guards; an unauthenticated request to a protected route was denied.
- [x] Cloudflare dynamic traffic was not cached as public static content during checks.
- [x] The database and WhatsApp worker are not intentionally exposed as public Cloudflare endpoints.
- [x] GA4 reporting API expects an authenticated platform administrator and keeps private Google credentials on the backend.

Additional audits remain prudent for session cookies, forwarded-client-IP trust, CSRF protections, webhook signature handling, Stripe live mode, logs and error reporting.

## 9. What was tested vs. what is still pending

### Evidence collected

- [x] Website, pricing, login and registration pages: HTTP 200 via cPanel.
- [x] API `/api/health`, public plans and public OAuth provider settings: HTTP 200.
- [x] Protected API request without credentials: HTTP 401.
- [x] Shared production-plan data from old VPS and cPanel matched at cutover.
- [x] VPS SSH tunnel and watchdog functionality restored after a stale socket/process-detection issue.
- [x] Cloudflare Universal SSL active, Full (strict), HTTP redirect, HTTP/2, HTML compression and static CSS cache HIT.
- [x] Email DNS preservation and service ports checked.
- [x] Public GA4 property contained real reporting events.
- [x] Latest pre-summary GitHub feature-branch commit passed six workflows.

### Acceptance still required before calling the platform fully complete

- [ ] Real email/password login, Google sign-in and GitHub sign-in using approved test accounts.
- [ ] Authenticated dashboard navigation, subscription plan changes, renewal/expiry behavior and tenant separation.
- [ ] Actual WhatsApp QR pairing, session persistence, message send/receive, media transfer, webhook delivery and rate-limit enforcement.
- [ ] Actual live Stripe checkout, webhook signature verification, success/retry/idempotency and customer billing/portal flow.
- [ ] Actual outbound and inbound cPanel email, mailbox authentication and deliverability checks.
- [ ] GA4 admin backend service-account Viewer grant, private credential setup, authorized report loading and realtime figures.
- [ ] Verify VPS Redis transport health and audit cPanel ingress proxy/IP trust assumptions after the Cloudflare cutover.
- [ ] Final local/field performance sampling after DNS cache expiration and any approved pending UI optimization release.
- [ ] Confirm newest GitHub release is deployed before calling server runtime and branch identical.
- [ ] Plan and approve the removal of **only** temporary old VPS web/API containers after the rollback window. Never retire PostgreSQL, Redis or WhatsApp services.

## 10. Suggested next actions (in practical order)

1. **Finish GA4 backend connection** in Google Cloud and GA4 Property Access Management, then securely install the service-account configuration on the cPanel API server and test the protected reporting endpoint.
2. **Run real authenticated smoke tests** for login, dashboards and subscriptions on the Cloudflare front door.
3. **Test WhatsApp and worker routing end-to-end** while observing the VPS tunnel and worker/session logs; do not restart or migrate the worker.
4. **Test Stripe and cPanel email** with safe/approved transactions and mailbox access.
5. **Recheck live Lighthouse from a client that resolves to Cloudflare**, then release and verify any still-pending approved Next.js optimizations.
6. **Audit GitHub deployment workflows**, approve the intended release/merge strategy, and keep a rollback plan for both web and API.

## 11. Quick links

- [Production website](https://relaywa.com)
- [GitHub project](https://github.com/Haider-Shakoori/wa)
- [PR #120](https://github.com/Haider-Shakoori/wa/pull/120)
- [cPanel migration and Cloudflare runbook](docs/cpanel-migration.md)
- [Cloudflare DNS/TLS reference](deploy/cloudflare/zone-config.example.json)
- [Google Analytics backend setup](docs/google-analytics-reporting.md)
- [Google Analytics](https://analytics.google.com/)
- [Cloudflare dashboard](https://dash.cloudflare.com/)

---

**Maintenance rule:** After every substantial RelayWA release, append a dated section identifying: GitHub commit/PR, affected services, whether changes were *committed* or *deployed*, tests/metrics actually observed, unresolved issues, and rollback instructions. Preserve the cPanel/VPS separation as the source of truth.
