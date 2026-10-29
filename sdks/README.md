# RelayWA SDK previews

**Unpublished, experimental server-side packages.** These are not production-ready registry releases.

| Language | Source | Implemented SDK surface |
|---|---|---|
| TypeScript | `packages/sdk-typescript` | Text/media/advanced messaging, session lifecycle and read-only resources, webhook management and signature verification |
| PHP 8.1+ | `sdks/php` | Text/media/advanced messaging, session lifecycle and read-only resources, webhook management and signature verification |
| Python 3.9+ | `sdks/python` | Text/media/advanced messaging, session lifecycle and read-only resources, webhook management and signature verification |
| .NET 8+ | `sdks/dotnet/RelayWA` | Text/media/advanced messaging, session lifecycle and read-only resources, webhook management and signature verification |

## Operational safety

Use only on a trusted server with a session-bound Bearer key stored in environment variables or a secret manager. Never embed keys in browser bundles, Android or iOS applications. Session connect, disconnect, restart, and delete operations affect live sessions **when invoked by an application**. No SDK test should call production endpoints. Avoid automatic retries of sends or mutations: timeouts do not establish that an operation failed, and retrying may duplicate effects. Implement application-level idempotency where supported by the API.

## Coverage and release status

- Advanced messaging includes location, contact, poll, reply, and reaction actions.
- Session resources include list/details, QR, statistics, logs, messages, contacts, chats, and groups.
- Webhooks include management operations and signature verification.
- HTTP and offline CI checks are not a substitute for end-to-end integration, package publication, and security review.
- The source-only SDK PRs do not change production API, engine, queues, sessions, databases, or deployment files.

API documentation: https://relaywa.com/api-docs.
