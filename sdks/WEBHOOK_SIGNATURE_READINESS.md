# Webhook signature verification: implementation gate

## Verified from backend source

- `apps/api/src/webhooks/webhooks.service.ts` generates a random 32-byte base64url secret when an endpoint is created, encrypts it for storage, and returns it **only on creation**.
- `apps/api/src/webhooks/webhook-crypto.ts` encrypts secrets using AES-256-GCM. This is encryption **at rest**, not an outgoing webhook signature algorithm.
- `apps/api/src/webhooks/webhooks.controller.ts` exposes endpoint management and delivery-history routes. It does not define delivery signature headers.

## Blocking contract questions

Before shipping SDK signature-verification helpers, inspect the actual outgoing delivery sender/worker and establish:

1. Exact signature header name and encoding (hex, base64, or base64url), including any prefix/version.
2. Exact MAC algorithm and input bytes (raw body, timestamp + delimiter + body, etc.).
3. Timestamp header, acceptable clock skew, and replay protection rules, if applicable.
4. Whether key material is the decoded base64url secret or the literal secret string.
5. Whether signing is actually enabled for all outgoing webhook deliveries.

Do **not** invent a verifier or present the encrypted secret storage as proof of HMAC signing. Once the sender contract is established, add deterministic cross-language vectors and negative tests for body modification, wrong key, malformed header, stale timestamp, and constant-time comparisons. Verify against the sender's own generated signature, not a second copy of an assumed formula.

**Production isolation:** this review does not call live webhooks or modify delivery workers.
