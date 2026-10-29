# RelayWA SDK production compatibility gate

These SDKs are **previews** until the checks below are completed. Passing offline CI does not certify live API compatibility.

1. Confirm the session-bound Bearer key's permissions against each route. Read-only session, group and webhook routes may require different scopes than send-message; document this before advertising them.
2. Verify successful and unsuccessful JSON response shapes, pagination, error payloads and rate limiting against the backend route implementation.
3. Confirm media payload contracts and webhook HMAC signature algorithm using the server source before adding those SDK features. Do not invent API fields.
4. Test 401, 403, 404, 429, 5xx, timeout, invalid JSON and network errors with mocked transports. Never use live customer sessions for testing.
5. Do not publish package versions until registry ownership, license and package provenance are confirmed. The TypeScript package remains private by design.
6. Do not deploy RelayWA services as part of SDK packaging. Public website installation links must refer to real published packages.

## Current blocker

The SDK package dry-run workflow from PR #151 was not visible on `main` at the time this gate was prepared. Verify its merge status separately before relying on its checks as a main-branch release gate.
