# RelayWA SEO Batch 12 — pre-release Chromium browser gate

**Scope:** Add real headless Chromium viewport tests and screenshot artifacts for public English SEO routes in GitHub Actions. This is not a production crawl or live Google indexing claim.

## Tested on each PR that changes the web app or this preflight

- Eight reviewed public URLs render HTTP 200 with SSR H1/main, English HTML, individual description and canonical metadata.
- Blog articles render actual schema and human-readable verification date.
- Mobile 390px and desktop 1440px browser profiles capture full-page screenshots of home, pricing, docs, help and the article index.
- `/sitemap.xml` contains **only** approved English public URLs, not unpublished country/draft article pages.
- Country and translation placeholders plus draft article slugs return 404 and `X-Robots-Tag: noindex`; private dashboard responses also remain non-indexable.
- `/docs` redirects to `/api-docs`, and Portuguese `Accept-Language` does not redirect global English visitors.
- Existing pricing and help documentation links remain reachable in SSR content.

Workflow: `.github/workflows/seo-browser-preflight.yml`. Tests: `tests/seo-e2e/public-seo.spec.cjs`. It installs pinned Playwright into a standalone test directory during the GitHub Action, builds the repo's web app, starts the production Next server, tests in Chromium desktop/mobile emulation and saves HTML reports and screenshots under workflow artifacts for 14 days.

## Verification caveats

- Browser automation uses **local GitHub runner** build. It does not test the VPS domain, public TLS, DNS, CDN, Meta/WhatsApp transport or true mobile iOS/Safari.
- Page presence and metadata are testable; search position, organic clicks, conversion attribution and real CrUX Core Web Vitals cannot be concluded from this script.
- Authenticated user registration, billing, API send and dashboard privacy require existing application tests plus staged user-flow checks (do not create live charges).
- Before deployment: ensure all PRs green, no credentials in rendered HTML/assets, run dependency audit, production Compose, Lighthouse and a live staging browser check.
- After approved deployment: inspect `https://relaywa.com/robots.txt`, `/sitemap.xml`, all canonical pages, HTTPS/hreflang and noindex; submit the sitemap to Google Search Console and Bing Webmaster Tools if access exists; capture real impressions/conversions, not fabricated metrics.
- Obtain permission before any real opted-in WhatsApp session/worker smoke. Deployment through Desktop Commander only when GitHub release gates are satisfied and an authorized push is requested.

**Status:** Incremental Batch 12 quality engineering; production rollout, organic measurement and 90-day content cadence are still outstanding.
