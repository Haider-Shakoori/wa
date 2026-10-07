# RelayWA SEO

Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS website origin before building or deploying. It defaults to `https://relaywa.com`; do not point it at the customer or platform administration host. This origin controls canonical URLs, Open Graph images, structured data, robots.txt, and the sitemap.

The indexable pages are `/`, `/pricing`, `/api-docs`, and `/help`. Each has its own title, description, canonical URL, and social metadata. The duplicate `/docs` route and account, checkout, onboarding, login, and platform routes use `noindex`. They remain crawlable so crawlers can read the noindex directive. Authentication remains responsible for protecting private content.

The branded favicon lives at `/favicon.ico`; Apple and PNG icons remain under `/brand`. `/opengraph-image` generates the 1200×630 social preview. `/manifest.webmanifest` supplies application branding. The homepage includes Organization, WebSite, and SoftwareApplication JSON-LD without fabricated ratings or reviews.

After deployment, verify public pages return HTTP 200, check canonical URLs, and submit `/sitemap.xml` in Google Search Console. Site ownership verification requires the owner's Search Console account. Keep pricing descriptions in sync with the subscription catalog when prices change.

For a Lighthouse SEO audit, run:

```sh
npx lighthouse https://relaywa.com --only-categories=seo --output=html --output-path=seo-audit.html
```

An SEO audit score covers technical checks; it does not guarantee search rankings or indexing.

## Verified local results — October 7, 2026

Lighthouse 12.8.2, SEO category, headless Microsoft Edge, against the local development server:

| Page | SEO score |
| --- | --- |
| `/` | 100/100 |
| `/pricing` | 100/100 |
| `/api-docs` | 100/100 |
| `/help` | 100/100 |

The JSON reports are `seo-audit.json`, `seo-audit-pricing.json`, `seo-audit-api-docs.json`, and `seo-audit-help.json` in the workspace root. `node scripts/check-seo.mjs` also passed rendered metadata, unique titles, canonical URLs, main headings, noindex rules, sitemap, robots, favicon, social image, manifest, and structured-data checks. Web TypeScript checks passed.

Re-run the audit against the deployed URL after configuring the public origin. These local results do not measure production hosting or search engine indexing.
