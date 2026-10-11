# RelayWA — Verify with WhatsApp (user-initiated)

## Why

Mobile applications in Afghanistan can register phone numbers without paying for SMS or paid outbound WhatsApp authentication messages. A user opens WhatsApp and **sends** a short-lived challenge to an official RelayWA Cloud API business number. RelayWA receives the signed Meta webhook and marks the challenge verified. **RelayWA sends no reply or OTP.**

This flow proves control of a WhatsApp account associated with the *same phone number* typed at registration. It does not verify numbers that lack WhatsApp. The user must press **Send**; opening a prefilled link by itself is not verification.

## Prerequisites (not included in the code)

- Provision and verify a WhatsApp Business Platform / Cloud API number and its webhook subscriptions with Meta.
- Configure `RELAYWA_VERIFY_WHATSAPP_NUMBER` (digits, country code, no +), `RELAYWA_VERIFY_META_PHONE_NUMBER_ID`, `RELAYWA_VERIFY_META_APP_SECRET`, `RELAYWA_VERIFY_META_WEBHOOK_TOKEN` on the API server.
- Configure an HTTPS publicly reachable Meta callback: `https://relaywa.com/api/v1/verifications/whatsapp/meta/webhook`. **Do not use a QR/Baileys session for inbound production verification.**
- Run migrations before enabling the feature. Do not provision credentials in GitHub or embed RelayWA API keys inside Android/iOS app binaries.
- Production reverse proxy must preserve request body for signed webhook validation. Keep rawBody enabled in Nest.

## Integration for customer application

All RelayWA API calls below are **server-to-server**, with an *organization* API key scoped to `verifications.manage` and `verifications.read`. The customer application backend authenticates its own users and retains the challenge ID bound to their pending signup session.

1. Mobile app sends its registration phone number to its **own backend**, which canonicalizes it to E.164 (e.g. `+937xxxxxxxx`).
2. Backend calls `POST /api/v1/verifications/whatsapp` with JSON `{"phone":"+937xxxxxxxx"}` and its bearer API key.
3. RelayWA returns `{"id":"uuid","status":"pending","expiresAt":"...","whatsappUrl":"https://wa.me/..."}`. Pass *only* the URL and challenge ID to the mobile app; never expose the API key.
4. Mobile app opens `whatsappUrl`. WhatsApp pre-fills `VERIFY <random secret>`; **user presses Send**.
5. Meta signs and posts the incoming user message; RelayWA checks the webhook HMAC and business number, matches the sender to the submitted E.164 phone and checks unexpired hashed challenge.
6. The customer backend polls `GET /api/v1/verifications/whatsapp/:id`; when status is verified it calls `POST /api/v1/verifications/whatsapp/:id/consume`, receiving the verified phone number. The backend completes its own signup once, then tells the mobile app to proceed. Do not sign up on the basis of client-supplied status or a raw WhatsApp deep-link.
7. Handle expired codes or unavailable WhatsApp with retry and an optional alternative (email/SMS), with a fresh challenge. The app should resume when it becomes foregrounded again.

## Safeguards

- Cryptographic random 192-bit challenge, SHA-256 hash in database, five-minute expiry, single-use consumption and atomic sender matching.
- Raw request body verified with Meta App Secret HMAC, compare constant-time; no unsigned webhook can mark a phone verified.
- Tenant isolation through authenticated org API keys; account scopes `verifications.manage` and `verifications.read`. Session-scoped API keys do not work.
- Maximum five challenges per number and 1,000 per tenant across a rolling 24 hours (configurable `PHONE_VERIFY_DAILY_LIMIT`), with a PostgreSQL advisory lock against concurrent quota races.
- No outbound WhatsApp message is sent. Incoming messages are not billed as outbound API deliveries; RelayWA subscription/hosting/processing costs may still apply.
- Customer app should additionally enforce per-device/IP throttles, registration fraud detection, and CSRF-safe server session association. Never treat a bare client-side polling response as proof of account creation.
- Meta may update WhatsApp pricing or policy; confirm official API availability in the target region before marketing a guarantee of zero cost.
- This release does **not** add a customer-facing verification dashboard, Meta Embedded Signup, multi-business WhatsApp sender routing, or native Android/iOS client SDK. It implements a platform-operated WhatsApp number as an initial backend integration.

## Testing and release

Run `pnpm --filter @wa/api typecheck`, `pnpm --filter @wa/api test`, normal monorepo CI, and migration against staging PostgreSQL. Configure test Meta Cloud webhook credentials. Perform a live registration with a real Afghanistan WhatsApp number matching the submitted phone, a mismatched sender, expired token, duplicate webhook and revoked API key. Verify no outbound Meta API message was attempted. **No production credentials/deployment are included.**
