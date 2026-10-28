# RelayWA search visibility audit — 2026-10-28

## Baseline (Google Search Console, user-provided)
- Last 28 days: 119 impressions, 8 clicks, 6.7% CTR.
- Three-month screenshot: average position 34.1 (not the same reporting period).
- Individual queries: "whatsapp api pricing" 14 impressions at position 82.64; "whatsapp web api" 2 at 51.5; "whatsapp nodejs" 1 at 56; "whatsapp webhook" 1 at 77.
- Small samples: do not infer reliable trends, rank gains, or conversion performance.

## Code review of main
- `apps/web/app/sitemap.ts` uses published page registry; `robots.ts` exposes sitemap and excludes /api/.
- `apps/web/lib/public-pages.ts` already lists homepage, pricing, docs, blog, tutorials, QR and webhook landing pages, and Cloud API comparison.
- `apps/web/lib/seo.ts` already provides canonical URLs, unique metadata, Open Graph and Twitter metadata.
- Webhook and QR landing pages contain substantive explanatory copy and links.
- Do not create duplicate keyword doorway pages or misrepresent unofficial QR sessions as Meta Cloud API.

## Verification checklist before any production SEO change
1. Fetch production /robots.txt and /sitemap.xml; verify HTTP 200, XML validity, expected URLs and correct canonical host.
2. Check Search Console indexing and URL Inspection for /pricing, /api-docs, /whatsapp-webhooks, /whatsapp-api-qr-code and the two developer articles.
3. Compare rendered production HTML (not just source code) for title, description, canonical, robots directives, structured data, and server-rendered body content.
4. Verify redirects for www/non-www, trailing slash and HTTP/HTTPS; avoid redirect chains.
5. Check mobile Core Web Vitals and Lighthouse on homepage, pricing and documentation.
6. Check that login/dashboard/auth pages are noindex and excluded from sitemap, and that auth content is protected.
7. Audit GA4 signup -> API key -> connected session -> paid activation events, respecting privacy and consent.
8. Test internal navigation from home/pricing/docs to relevant developer guides and back.
9. Run pnpm checks and Cloudflare preview deployment; verify sitemap and canonical output in preview before merging.

## Content priorities based on observed demand
1. Improve /pricing with current, accurate plan details and clear distinctions from Meta's official API. Avoid invented prices or guarantees.
2. Improve /api-docs and Node.js article with verified runnable examples, auth, status and error handling.
3. Link /whatsapp-webhooks from the docs and relevant blog articles; validate sample payloads against actual API implementation.
4. Reassess after 28 days using page-level impressions, clicks, position and registration conversions.

## Acceptance criteria
- No duplicate URLs, misleading official-API claims, invented prices, or fabricated features.
- All published pages have unique titles, canonical URLs and useful original content.
- Search Console indexing checks and preview smoke tests recorded before release.
- No production deployment from this audit-only PR.
