# RelayWA: Google Search Console, GA4 and Windsor.ai account repair

**Purpose:** Fix Google identity / property selection and provide a safe website ownership-verification fallback without weakening RelayWA's analytics consent rules.

## What the repository proves—and cannot prove

- Public GA4 web tracking uses measurement ID `G-61Z26DFM1V` in `apps/web/components/google-analytics.tsx`. A visit is tracked only after explicit **Allow analytics** on an approved public marketing page. Tracking intentionally does **not** run on private account, tenant, billing or dashboard pages.
- The separate *Platform Admin > Google Analytics* reporting integration expects GA4 **property ID `558119248`** and a private API service account (`relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com`) with GA4 Viewer permission. Server-side reporting is separate from website page view collection and from Windsor.ai's own Google OAuth.
- An analytics measurement ID is NOT a Search Console ownership token or proof that an email can access Search Console. A GSC property, a GA4 property, their Google account permissions, their link and Windsor's connections are separate.
- Windsor can show `sc-domain:businessos.af` while `relaywa.com` remains absent; that does not prove RelayWA is broken or that Google Analytics has stopped collecting. Likewise, a GA4 ID written in source does not prove the current Google property matches.

## Repair access using the correct Google account (user action)

1. Visit https://search.google.com/search-console and **explicitly switch to the Google account that shows RelayWA in the native property dropdown**. Check for `sc-domain:relaywa.com` or the URL-prefix `https://relaywa.com/`. These are DIFFERENT Search Console property types.
2. If RelayWA appears in the native Google interface but not in Windsor, open GSC **Settings > Users and permissions** as a property owner. Ensure the Google account selected in Windsor is an authorized user. Add it from this page if needed; don't create a redundant property or delete/revoke the existing verified owner.
3. If no RelayWA property exists for any authorized owner, create one. Prefer a **Domain property** for `relaywa.com`; Google supplies a one-off `google-site-verification=...` TXT value that must be published in the **authoritative DNS zone for relaywa.com**. Do not invent the token, change nameservers, or remove existing TXT/MX/SPF/DKIM/DMARC/verification records. Keep DNS tokens intact after verification.
4. **Alternative URL-prefix ownership:** create/select `https://relaywa.com/` (including https and trailing slash). Select Google's HTML tag method, copy ONLY the `content` attribute of Google's `google-site-verification` meta tag into `GOOGLE_SITE_VERIFICATION` **at Next.js build time**. The optional website metadata will then render `<meta name="google-site-verification" content="..."/>` in the public HTML `<head>`, before any consent. Check *view source* and Google Verify. The runtime/VPS Dockerfile must explicitly forward this environment variable as a Docker build arg; merely writing it to `.env.production` after building will not change statically generated metadata. Prefer DNS for a Domain property. The token is public by design, **not** a client secret or OAuth token.
5. Avoid Google-Analytics-based website ownership verification: RelayWA GA4 JavaScript loads **only after opt-in**, while Google verifies page-source HTML tag placement. Google Analytics ownership method also requires a matching Google account with appropriate rights and only covers URL-prefix properties.

## Verify GA4 in the native console

1. Open https://analytics.google.com/analytics/web/ , select the Google account and GA4 property serving **relaywa.com**, then Admin > Data streams > Web. Verify that the real Measurement ID is `G-61Z26DFM1V` and the target GA4 **property ID** is `558119248`. If either differs, STOP and confirm the intended property before changing the application's code; do not reuse BusinessOS's or another product's analytics stream accidentally.
2. Open `https://relaywa.com/` in a normal browser session, choose **Allow analytics** (or clear the stored consent preference to show the prompt), and use Google Tag Assistant at https://tagassistant.google.com/ or GA4 Realtime to verify that the intended measurement ID emits a `page_view`. Realtime availability is NOT Search Console indexing.
3. In GA4 Admin > Property access management, give the RelayWA reporting service account Viewer access to property `558119248` if it needs reporting. Do not send JSON private keys, GA4 access tokens or a password to chat, source control or Windsor.
4. For a separate Windsor GA4 connection, authorize through https://onboard.windsor.ai/connect?connector=googleanalytics4&client=CHATGPT&next=/googleanalytics4/authorize using a Google account with permission to the same GA4 property, then **select the property before finishing**.
5. For Windsor Search Console, use https://onboard.windsor.ai/connect?connector=searchconsole&client=CHATGPT&next=/searchconsole/authorize with an account already authorized for the **verified** RelayWA Search Console property. Select the RelayWA site in Windsor before Finish. Windsor may be logged into one email while the Google consent screen picks a different email.

## Link GSC and GA4 (separate optional Google product association)

After permissions and verification work in Google itself, choose GA4 Admin > Product links > Search Console links > Link. Select the verified RelayWA Search Console property and its matching web data stream. This requires a **verified GSC owner** and **GA4 Editor**, and the two products must cover the same website. An existing link may already be present—inspect it before replacing it.

## Safety / acceptance checks

- GSC: native Google property visible to the intended account and verified; no previously active TXT or HTML verification records removed. Google can open `https://relaywa.com/robots.txt` and `https://relaywa.com/sitemap.xml`; search indexing is checked in Google's Page Indexing/URL Inspection after access is restored.
- GA4: native property/stream match the IDs above; optional-consent public visit appears in the expected GA4 Realtime, not just an unrelated BusinessOS or test property.
- Windsor: connector lists `relaywa.com` alongside, rather than instead of, `businessos.af`, and GA4 lists the intended RelayWA property.
- Consent: no Google tag request or `page_view` before opt-in; private routes remain excluded.
- The RelayWA Platform Admin API reporting status can be **not_configured** or **error** even if browser page views work, because it needs its own API service-account credential + GA4 permissions. Check independently.

Google references:
- https://support.google.com/webmasters/answer/7687615
- https://support.google.com/webmasters/answer/9008080
- https://support.google.com/analytics/answer/9539598
- https://support.google.com/analytics/answer/15756111
- https://support.google.com/analytics/answer/10737381
