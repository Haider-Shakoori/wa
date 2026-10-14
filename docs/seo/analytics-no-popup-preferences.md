# RelayWA: Cloudflare cookie message and analytics preferences

## Current live behavior (14 October 2026)

The previous *no-popup* marketing experience was replaced with a compact
**"We use cookies"** notice on approved public marketing pages only. It appears
on the homepage, pricing, documentation, help, blog/tutorials and the three
high-intent SEO pages. It is not displayed on login, checkout, dashboard,
messaging, platform or API routes.

The notice provides equally accessible choices:

- **Accept optional** stores `relaywa_analytics_consent=granted`.
- **Reject optional** stores `relaywa_analytics_consent=denied`.
- **Cookie settings** opens `/analytics-preferences` to review or change
  the preference at any time.

The existing Next.js public analytics component subscribes to
`relaywa:analytics-choice-changed` and reads the stored choice. The notice
uses that contract without adding another tracking script, reporting endpoint,
persistent user identifier, or cookie of its own. It disappears after the
visitor has explicitly chosen, including on later visits, and remains
non-modal and responsive on mobile.

## Privacy and regional behavior

Changing the presentation to a *cookie message* does **not** bypass consent
requirements. EEA, UK, Switzerland and unknown/unverified countries still
require an explicit opt-in before Google Analytics is loaded. In eligible,
verified countries the current regional policy may enable basic public-page
GA4 automatically before a choice is made, unless the visitor previously
declined. This behavior has not been changed by the notice release. A saved
decline always takes precedence over regional defaults.

Google Consent Mode v2 basic and denied advertising permissions stay in
place; authenticated private pages are excluded. First-party approximate
website traffic reporting remains independent of this message.

## Cloudflare implementation and rollback

The deployed `relaywa-web` Worker is not rebuilt. The existing isolated
`relaywa-seo-pages` Worker serves cookie JS/CSS and, using narrow **exact**
Cloudflare Worker Routes, injects a same-origin deferred loader into the
eight original public marketing pages using HTMLRewriter. The three SEO
snapshot pages include the same loader. The sitemap remains unchanged,
with its 11 original/new canonical URLs.

The `workers.dev` previews are explicitly marked `noindex`. Cloudflare
route checks reject conflicts; production GitHub Actions builds, smoke-checks
and runs desktop/mobile Playwright tests, rolling back only newly created
routes if those checks fail. Original application, API, platform Workers and
their D1/database bindings were not changed.

Staging: https://github.com/Haider-Shakoori/wa/actions/runs/38525912388

Production: https://github.com/Haider-Shakoori/wa/actions/runs/38526474763

The cookie notice should eventually be integrated into the canonical source
of the deployed Cloudflare Worker when that build configuration is available,
without introducing duplicate banners or weakening the analytics choice
contract. Privacy counsel should reassess country-specific requirements as
market coverage expands.
