# Adaptive login CAPTCHA (draft PR #72)

**Production is not changed.** Release requires explicit owner approval and a test environment first.

## Current MFA implementation
Platform administrators can enroll any RFC 6238-compatible authenticator,
such as Google Authenticator, Microsoft Authenticator, 1Password or Aegis.
RelayWA uses a standard six-digit 30-second TOTP with HMAC-SHA1.
Authenticator secrets are encrypted with AES-256-GCM and individual recovery
codes are hashed in the database. There is no custom RelayWA authenticator app.

## Adaptive password-login CAPTCHA
Both customer `/login` and private `/platform/login` call
`GET /api/auth/login-protection?email=…`. A CAPTCHA is shown **only** if the
backend reports elevated risk.

Shared counters live in PostgreSQL and use stable HMAC-SHA256 fingerprints
of IP, account and the account+IP combination, not raw passwords, emails, or
IP addresses. All threshold decisions are enforced again by the API when the
password is submitted; hiding the UI cannot bypass protection.

Within a sliding 15-minute interval:
- 3 failed passwords for the same account+IP trigger CAPTCHA.
- 8 failures against one account across IPs trigger CAPTCHA.
- 12 failures from one IP across accounts trigger CAPTCHA (spray detection).
- 60 failures from one IP trigger a temporary 15-minute block regardless of
  valid CAPTCHA.
- Existing separate administrator lockout after 5 failed password attempts
  still applies, even when Turnstile is configured.

The API checks the Cloudflare `siteverify` endpoint (not a client-side-only
flag), with timeout and optional hostname validation. Tokens are short-lived,
single-use and require a fresh challenge after a failed attempt. If Cloudflare
verification fails, sign-in fails closed. If the keys are missing, elevated-risk
sign-ins are temporarily blocked instead of bypassing protection.

Successful password logins clear account-specific failure windows. IP-level
history is retained until it naturally expires to avoid weakening spray
protection for other accounts sharing that address.

## Cloudflare configuration for staging / later production

Create a **Turnstile** widget for the website's real domain in your Cloudflare
account and privately configure the API environment:

```sh
TURNSTILE_SITE_KEY=<public widget site key>
TURNSTILE_SECRET_KEY=<private server-side secret>
TURNSTILE_EXPECTED_HOSTNAME=relaywa.com
# Optional: independent stable secret for pseudonymous counter keys
LOGIN_ATTEMPT_HASH_SECRET=<long random secret>
```

Use a different Turnstile widget hostname for isolated staging. Keep the
secret in VPS environment management, never in GitHub source, browser
JavaScript or public platform settings. Only the site key is sent to browsers.

This release relies on the prior trusted reverse-proxy IP correction;
verify Nginx overwrites forwarded headers and the API isn't directly
reachable. Ensure Nginx has its own HTTP rate limits on public auth routes
and the status endpoint, particularly for unwanted traffic spikes.

The first migration must include
`apps/api/migrations/042_adaptive_login_challenge.sql` before deploying
the new API. Test thresholds, invalid/missing tokens, timeout/provider
outage, CAPTCHA expired or reused tokens, different users sharing an IP,
password login with MFA, registration, Google and GitHub OAuth.

**Operational constraints:** the private API key cannot be configured via
the public website. Administrator MFA is additional to CAPTCHA; CAPTCHA
should not replace MFA.
