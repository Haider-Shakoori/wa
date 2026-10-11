# RelayWA: no-popup analytics preferences

Automatic GA4 works on approved public marketing routes for visitors whose country can be verified and whose stored choice is not denied. This behavior does not depend on acknowledging an on-page notice.

Visitors in the EEA, UK, Switzerland and unknown/unverified regions are not silently tracked by GA4. They may opt in using the separate /analytics-preferences page, linked in the footer. Stored declines override automatic region permission.

No consent popup, overlay, cookie banner, or deceptive Decline-while-tracking action appears on any page. Analytics preferences uses ordinary buttons on an ordinary navigable page. The choices persist in the browser and synchronize across tabs.

Google Consent Mode v2 basic remains in place; advertising signals remain denied. Private workspace, login and checkout pages remain untracked. The first-party aggregate request metrics are independent of Google Analytics.

## Verification

CI includes unit tests and desktop/mobile browser tests of eligible background tracking, unknown/protected region suppression, voluntary opt-in, explicit opt-out persistence, and no popups. Production rollout is web-only; maintain the current live image for rollback. Do not modify worker, Stripe, databases, DNS, geo-attestation credentials or the country resolution API.

Limitation: Restricting prompts to EEA/UK/CH does not establish that all other markets allow GA4 automatically; review regional privacy requirements as coverage expands.