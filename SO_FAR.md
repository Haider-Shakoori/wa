# RelayWA — Everything Completed So Far

> **Project status record | Updated 12 October 2026**
>
> Repository: [`Haider-Shakoori/wa`](https://github.com/Haider-Shakoori/wa)  
> Work branch: [`feat/cpanel-hosting-package`](https://github.com/Haider-Shakoori/wa/tree/feat/cpanel-hosting-package)  
> Tracking PR: [#120 — cPanel hosting package](https://github.com/Haider-Shakoori/wa/pull/120) (**open, draft, not merged**)  
> Live site: [https://relaywa.com](https://relaywa.com)
>
> **Scope:** This file records the RelayWA website/SaaS and its October 2026 migration, performance, Cloudflare, Google tag and GitHub work discussed and verified so far. It is **not** a secrets backup or a claim that every user-facing integration has been tested. "Working" indicates the particular checks named below; "pending" means it has not yet passed end-to-end verification.

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
