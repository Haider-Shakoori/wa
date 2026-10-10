# Batch 01 — Repository SEO audit
**Evidence date:** 2026-10-10. Inspected the `main` branch of `Haider-Shakoori/wa` using the GitHub connector. This is **not** an external live-site crawl or a codebase-wide audit; severity denotes implementation risk to validate.

| Finding | File/evidence | Severity | Action | Batch |
|---|---|---|---|---|
| Sitemap uses static 4-entry list | `apps/web/app/sitemap.ts`; `['', '/pricing', '/api-docs', '/help']` | High | Generate from an approved indexable-page registry, validate each 200 response | 02 |
| GA4 public page allowlist fixed to same four paths | `apps/web/components/google-analytics.tsx`; `trackedPublicPaths` | High for expansion | Share safe public route catalog; do not enable tracking of private SaaS paths | 03 |
| Pricing page has no per-page metadata export | `apps/web/app/pricing/page.tsx` | Medium | Add pricing-specific title, description, canonical, OG | 02 |
| Root layout uses `<html lang="en">` | `apps/web/app/layout.tsx` | High for international | Set per-locale language and Arabic RTL only on real translated routes | 05 |
| Site-level metadata and social previews already exist | `apps/web/app/layout.tsx`, `apps/web/lib/seo.ts` | Existing asset | Retain and extend route-specific semantics | 02 |
| Canonical builder exists | `apps/web/lib/seo.ts` uses `NEXT_PUBLIC_SITE_URL` + route | Existing asset | Check normalization, dynamic locale routes and URL equivalence | 02/05 |
| robots currently allows public pages and disallows `/api/` | `apps/web/app/robots.ts` | Needs review | Indexability/noindex audit for login, admin, tenant and trial/personal-data pages | 02 |
| Basic JSON-LD on home | `apps/web/app/page.tsx`: Organization, WebSite, SoftwareApplication | Existing asset | Validate production output and only add supported schema types | 11 |
| API docs contain live snippets for cURL/JS/Laravel/Python/C# | `apps/web/app/docs/page.tsx` | Opportunity | Split high-intent docs into crawlable deep-linkable pages, preserve current UX | 07/10 |
| Next.js App Router architecture; standalone output | `apps/web/package.json`, `apps/web/next.config.ts` | Existing asset | Build server-rendered public marketing pages and strong tests | 04/05 |
| CI already performs typecheck, tests, build, audit and Compose config | `.github/workflows/ci.yml` | Existing asset | Layer public route SEO assertions + accessibility checks | 02/12 |
| Messaging layer uses Baileys and whatsapp-web.js | `apps/worker/package.json` | High claim risk | Explicitly distinguish QR/session messaging from official Meta Cloud API | 01/11 |
| Site has GA4 measurement ID and privacy guard | `apps/web/components/google-analytics.tsx` | Existing asset | Track safe signup-to-paid funnel with privacy/consent considerations | 03 |

## Required live validations, not yet performed
1. Fetch `https://relaywa.com/`, `/pricing`, `/api-docs`, `/help`, `/docs` if present, `/robots.txt` and `/sitemap.xml` from a production browser/crawler and record HTTP, rendered title/meta, canonical, noindex, response, redirect chains and internal links.
2. Verify domain property access in Google Search Console and Bing Webmaster Tools; export settled 28/90-day total clicks, impressions, CTR, position, country, query, landing page and indexing coverage. Access to the connected GSC Wizard was blocked by expired trial in this session; no GSC numbers collected.
3. Verify GA4 property and conversions; current code presence alone does not prove collection, consent compliance or healthy data.
4. Run PageSpeed/Lighthouse mobile and desktop, crawl at least current public URLs and check robots/private route exposures.
5. Confirm all copy promises against actual API, UI, trial and billing behavior before publishing.

## Important implementation constraints
- `robots.txt` is **not** a privacy control; authentication and authorization protect private content. Consider explicit noindex for public-facing signin/utility pages if appropriate.
- Never allow tracking or site index to include private admin/tenant workspace paths or message content, phone numbers, API keys and invite tokens.
- The four-route sitemap may intentionally omit authentication screens; do not blindly add all App Router routes.
- Public localized content must be crawlable in HTML and not depend on a JavaScript-only locale swap.

## Batch 01 completion boundary
This research batch makes **no application runtime changes**, no live deployment and no claim of measured ranking improvement. It specifies scope and validation for subsequent engineering.
