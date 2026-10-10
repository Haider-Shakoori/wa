# SEO Batch 04 — Mobile performance and Core Web Vitals
**Issue:** https://github.com/Haider-Shakoori/wa/issues/81
**Status:** Implementation in feature branch; CI and Lighthouse must be reviewed before merging.

## Source-grounded baseline (not synthetic speed results)
- The Next.js root imports seven global CSS files; `app/globals.css` alone is roughly 167 kB **uncompressed source** and contains styles for marketing and workspaces. Removing/moving it without verified visual regression tests is risky; no global CSS purge was attempted in this batch.
- Before this batch, marketing `relay-home.tsx` and API docs imported the **entire** interactive `relay-workspace.tsx` module (roughly 36 kB source, before dependencies) just to render shared plan cards, brand and status badges.
- The homepage preview animated text with repeated timeout-triggered React re-renders. This is avoidable work on slow devices.
- Site already self-hosts Inter Variable via `@fontsource-variable/inter`, uses SVG icons from `react-icons` and displays a 70 kB PNG web wordmark. No Google Fonts remote stylesheet is needed for text.
- GA4 introduced in Batch 03 is client-loaded only after optional opt-in; do not change it to an unconditional render-blocking script.
- The source repository does **not** contain verified production CrUX 75th-percentile field data, Lighthouse run scores, or a production traffic-tested LCP/INP/CLS baseline.

## Optimizations delivered
1. Isolated `Brand`, `Badge`, `PlanCards`, and `Plan` in `apps/web/components/marketing-primitives.tsx`. Home and docs now import from the smaller component instead of directly importing tenant `relay-workspace.tsx`. The original workspace exports remain compatible through re-exports. Bundling should avoid workspace-only modules on the marketing route (verify in Chrome DevTools/Next bundle analysis).
2. Header wordmark uses Next's `Image` optimization with explicit intrinsic dimensions (145×35), allowing responsive and cached image formats. CSS remains visually aligned with the original wordmark.
3. Simplified hero API code preview to server-rendered constant content; no multi-timeout text typing animation or 30ms React state updates. Preserved markup, styles, code example and cursor decoration.
4. Added skip-link, public main-content landmarks, visible keyboard focus rings, 44px minimum coarse-pointer navigation/tabs, and `prefers-reduced-motion` support. Example code tabs now respond to arrow/home/end keyboard navigation.
5. Added a production-build smoke script `scripts/seo-perf-budget.mjs` in the main CI job to fetch actual locally served rendered HTML, verify 200, H1, main landmark, canonical, description, correct language, docs redirect, private noindex, assets and compressed-transfer caps:
   - Per HTML route: at most 60,000 bytes gzip.
   - Unique JavaScript assets collectively: at most 320,000 bytes gzip.
   - Unique CSS assets collectively: at most 75,000 bytes gzip.
   - These are **starting regression caps**, not performance targets or claims of good Core Web Vitals; tighten after recording successful baselines.
6. Dedicated `seo-lighthouse.yml` workflow audits **the built Next app on GitHub's Ubuntu runner**, not production, using Chrome + Lighthouse mobile emulation. Runs twice for `/`, `/pricing`, `/api-docs`, `/help`. Saves results as Actions artifacts (not public temporary links). Initial performance/accessibility/SEO, LCP and CLS assertions are **warnings** until a verified baseline establishes fair blocking thresholds. URL/crawler/bundle checks in main CI are required hard gates.

## How to review and verify
- View the PR's `CI` and `RelayWA Mobile Lighthouse` Actions checks.
- Download Lighthouse JSON/HTML artifacts from the workflow to inspect LCP, total blocking time, CLS, contrast and rendered screenshot.
- Inspect the Browser DevTools Network JS and CSS transferred bytes; compare to previous `main` build when possible, rather than inferring improvements from source sizes alone.
- Perform interactive mobile smoke: homepage header/nav/trial CTA, plan selection, docs search and code tabs (keyboard), login/onboarding/dashboard, Stripe checkout, and Google Analytics opt-in/decline behavior.
- After release, use PageSpeed Insights/CrUX at real `relaywa.com` to obtain **field** Core Web Vitals (target at 75th percentile: LCP <=2.5s, INP <=200ms, CLS <=0.1). Lighthouse simulated performance is **not** a field measurement.
- Verify accessibility with keyboard-only navigation and screen reader as lab warnings do not guarantee WCAG conformance.

## Deployment and limitations
- No VPS modifications in this batch; GitHub PR/test/merge only. Desktop Commander should be used solely for approved server push/pull in the deployment phase.
- All application authentication, WhatsApp session logic, customer data, subscription status and payment flows remain in their own modules.
- Follow-up after validating visuals: route-group style separation from the global ~167k CSS file, responsive images beyond the brand wordmark, speed improvements driven by real browser traces and field data.

## Measured GitHub CI lab snapshot (2026-10-10)
[GitHub Actions CI run #1210](https://github.com/Haider-Shakoori/wa/actions/runs/38082092635) compiled the Next.js app and served four public routes using `next start`. Across their **16 distinct CSS+JS asset URLs**, the downloaded source responses measured **225,165 bytes gzip JavaScript** and **46,614 bytes gzip CSS**, and pages measured **21,468 B gzip HTML for /**, **4,471 B for /pricing**, **17,472 B for /api-docs** and **4,885 B for /help**. All four returned HTTP 200 and passed server-rendered SEO assertions. The first draft budget values were intentionally relaxed; the gate was subsequently tightened to 320 KB JS, 75 KB CSS and 60 KB HTML. These figures are **not** Chrome transferred bytes with HTTP-level caching, lab Lighthouse metrics, or production field Core Web Vitals. Measured sizes cover the union of route-referenced assets, not each route’s independent load.
