# RelayWA SDK rollout (isolated development)

**Safety:** This branch changes only the standalone TypeScript SDK and its tests. It does not change apps/api, apps/worker, apps/web, infrastructure, database, or live deployment. Do not publish packages or merge until CI and API-contract review pass.

## Implemented in this branch
- Existing text send client preserved.
- Read-only sessions, QR metadata, session messages, contacts, chats, groups.
- Read-only webhook listing and delivery history.
- URL-encoded resource IDs and mocked network tests.

## Remaining release gates
1. Validate response shapes and permissions against the deployed API contract without sending live traffic.
2. Add typed response models, write operations, media upload contracts, and webhook signature verification after inspecting actual backend implementations.
3. Implement and test PHP/Laravel, Python and .NET SDKs as separate packages.
4. Add independent CI release gates and publish to npm/Packagist/PyPI/NuGet only with explicit registry credentials and release approval.
5. After packages exist, add SDK installation links to the public docs and optionally a dedicated /sdks page. This must be a separate web PR and must not modify service routes.

Do not advertise unpublished SDK packages as available.
