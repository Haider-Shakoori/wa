# RelayWA rebuild

User direction: preserve the working messaging engine and rebuild the commercial product around the workflows observed in WasenderAPI. Work stays local until deployment is requested.

## Reference review

Reviewed the public [website](https://wasenderapi.com/), [API documentation](https://wasenderapi.com/api-docs), and the authorized customer account's dashboard, session list, connected-session management, session settings, subscription catalog, and account settings. No source code or SSH was accessed. No reference account settings, subscriptions, sessions, or messages were changed. Credentials and customer content are not stored in this repository.

The observed navigation centers on Dashboard, Sessions, Subscription, and account settings. Session management brings credentials, test sending, webhooks, and logs together. Personal access tokens and session keys have different purposes. Public pricing scales by connected numbers with monthly and yearly billing.

The provided account exposed the customer workspace. Platform-admin parity remains unverified; a separate authorized entry point is needed.

## Implemented locally

- Original RelayWA landing page, pricing page, help page, sign-in and registration screens, and shared visual system.
- Routes: `/dashboard`, `/whatsapp`, `/whatsapp/:id`, `/subscription`, `/settings`, and `/api-docs`.
- Session search/filtering, creation, QR polling, restart/disconnect, editable name/phone hint, logs, and deletion of pending or logged-out sessions.
- Session credentials, account tokens, scope selection, revocation, text testing, message history, and workspace webhook creation/toggling.
- Public plan catalog shared with checkout. Basic, Pro, Plus, Business cost $6, $15, $30, $45 monthly for 1, 3, 6, 10 numbers; yearly prices apply a 15% discount.
- Paid monthly message quotas are explicitly unlimited; existing delivery pacing remains active. New accounts receive a three-day trial with one number and 50 messages daily.
- Trial subscription creation is atomic with account creation. Existing subscriptions retain their period dates.
- Added `sessions.manage` and `webhooks.manage` scopes. Scope and session binding checks remain enforced. Session deletion revokes its keys.
- Fixed Plus checkout validation and checkout URL handling.
- Portable, transactional migration runner excludes the conflicting obsolete webhook migration.
- Worker and messaging engines remain unchanged.

## Still required for full parity

| Area | Current limit / next work |
|---|---|
| Session configuration | Protection and message-logging toggles, read receipts, call rejection, online presence, event filtering, and proxies need engine-backed implementation. Current edit form handles name and phone hint only. |
| Webhooks | Endpoints currently apply to a workspace, rather than individual sessions. Add session selection, event selection, delivery inspection, and a simulator after defining the payload contract. |
| API compatibility | RelayWA retains `/api/v1/...` routes and its own payloads. WasenderAPI clients are not drop-in compatible. Add a tested adapter if compatibility is required. |
| Messaging | Verify and extend stickers, view-once media, uploads/decryption, edit/delete/read, resend, presence, username and passkey flows. Do not advertise unimplemented methods. |
| Billing | Existing providers are Stripe one-time checkout and administrator-reviewed manual payments. Recurring subscriptions, proration, cancellation, balances, invoice access, and Paddle are not implemented. Real checkout requires provider credentials. |
| Account settings | Profile editing, security/passkeys, notification preferences, theme persistence, team invitations and role management need dedicated workflows. Google sign-in is preserved when configured. |
| Integrations | RelayWA SDKs, n8n node, MCP service, and Postman collection need implementation and publication. WasenderAPI packages are not relabeled as RelayWA packages. |
| Public pages | About, contact, partner program, blog, status, terms, privacy, and refund policy need real company/support information and product decisions. No reference company identities, reviews, or legal claims were copied. |
| Platform administration | Existing RelayWA admin remains operational. Its redesign and full reference parity await an authorized admin reference. |
| Live transport | No customer's number was connected or live message sent during this rebuild. Verify QR pairing, transport recovery, media delivery, and signed webhook delivery with an authorized test number. |

## Verification

Latest pre-push checks: all service typechecks and production builds pass. Worker tests pass 43/43; API tests pass 65/67; web tests pass 33/46. The two API migration-chain assertions expect the former shell migration command. Several web assertions expect previous UI strings/routes; remaining failures require individual review. These checks do not substitute for production or live transport verification. See server-update-prompt.md for deployment instructions.

## Direct sending update

Outbound BullMQ and Redis dispatch, automatic retry, pacing, and duplicate-content suppression have been removed. API requests use an authenticated private HTTP worker listener and return after sending. Scheduling/retry options are rejected; callers implement them in their own job systems. Migration027 retires outstanding legacy queue rows. Worker tests pass 52/52, including real HTTP dispatch tests with mocked transport; API suite passes 68/68, including the direct-send behavior test. No real message was sent for this verification.
