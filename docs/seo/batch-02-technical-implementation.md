# Batch 02 — Technical SEO foundation
**Status:** Implemented in PR (confirm CI and merge before considering complete)  
**Issue:** https://github.com/Haider-Shakoori/wa/issues/79

## Public indexable page registry
`apps/web/lib/public-pages.ts` defines exactly four currently published indexable routes: `/`, `/pricing`, `/api-docs`, `/help`. These all have unique title/description, sitemap priority and change frequency, and deterministic self-canonical URLs. A new SEO page is **not** automatically discoverable or monitored: it must be approved and then registered, have its own page-level metadata, be tested, and be included in launch review.

The sitemap (`apps/web/app/sitemap.ts`) reads from the registry rather than maintaining a second hard-coded list. `apps/web/components/google-analytics.tsx` and the existing first-party analytics `apps/web/proxy.ts` use the same indexable-path check to avoid emitting public pageview events for tenant dashboards, admin paths, checkout or authentication.

## Private-route noindex HTTP headers
The pre-existing `apps/web/proxy.ts` already collects privacy-preserving first-party website metrics for selected document navigations. **It must not be replaced**. Batch 02 adds only:
- `X-Robots-Tag: noindex, nofollow, noarchive` to every nonpublic HTML route in the proxy's matcher, including auth, checkout, user subscriptions, dashboards and workspace pages.
- A `publicPages` check before website analytics collection; this keeps raw private path or query data out of marketing tracking.
- An explicit safeguard before the early return when analytics is disabled.

The proxy's existing matcher excludes `/_next/static`, `/_next/image` and `/api/`; API endpoints continue to require their own authentication and robot policy. The existing `robots.txt` disallows `/api/`, while private HTML document paths remain crawlable so `noindex` may actually be observed; robots.txt is **not** an access-control mechanism.

## Metadata and canonical rules
- Route metadata is generated from `marketingPageMetadata()` with a unique absolute title, description, canonical, OpenGraph and Twitter data. It prevents duplicate `| RelayWA` titles from the root template.
- `NEXT_PUBLIC_SITE_URL` is still the environment-configured origin, with default `https://relaywa.com`. **Set it to the real production canonical origin**. URL path/query fragments are removed for canonicals.
- The `/docs` legacy path permanently redirects to `/api-docs`, avoiding duplicate indexed copies of the same documentation; the underlying docs UI remains unchanged.
- A branded nonindexable Next.js 404 page links to helpful live pages.
- Locale routes and reciprocal hreflang will be introduced only after real translations are reviewed (Batch 05), not invented in the sitemap ahead of publication.

## Validation
The new `apps/web/test/seo-technical.test.mjs` loads the actual TS modules with TypeScript transpilation to exercise:
1. The exact public-page allowlist, uniqueness and private route exclusions.
2. Correct canonical normalization and metadata.
3. Dynamic sitemap entries without private URLs, query parameters or unapproved locales.
4. robots.txt sitemap reference and nonblocking crawler behavior for private noindex discovery.
5. Route-specific metadata exports and aligned GA4 allowlist.
6. Existing analytics proxy's preserved behavior and indexing guard.
7. Single-direction /docs permanent redirect and custom noindex 404.

Additionally run full GitHub CI (typecheck, tests, Next production build, Docker Compose checks, dependency audit). Production redirect response codes, robots response, and header behavior require a live post-deployment verification; a green unit test is **not** proof of live indexation.

## Post-deployment HTTP validation commands
```bash
curl -I https://relaywa.com/
curl -I https://relaywa.com/pricing
curl -I https://relaywa.com/api-docs
curl -I https://relaywa.com/help
curl -I https://relaywa.com/docs
curl -I https://relaywa.com/login
curl -I https://relaywa.com/dashboard
curl -I https://relaywa.com/unknown-page
curl -sS https://relaywa.com/robots.txt
curl -sS https://relaywa.com/sitemap.xml
```

Expected: approved public pages return 200 and indexable metadata; `/docs` permanently redirects once to `/api-docs`; private HTML requests return an appropriate noindex header (their HTTP status can depend on authentication). XML lists only approved URLs. Invalid paths return Next's 404. Verify actual HTTPS, redirects and canonical URLs in Google Search Console before declaring production SEO complete.

## Scope exclusions
No user changes to dashboard/auth/subscription logic, no translated pages, no new commercial feature pages, no GSC/Bing submission, and **no server deployment** in this batch.
