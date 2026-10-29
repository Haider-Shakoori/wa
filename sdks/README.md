# RelayWA SDK previews

**Unpublished, experimental packages.** These are isolated server-side SDK sources, not production-ready registry releases.

| Language | Location | Current coverage |
|---|---|---|
| TypeScript | packages/sdk-typescript | Text send, read-only sessions, directory and webhooks |
| PHP 8.1+ | sdks/php | Text send, session list, webhook list |
| Python 3.9+ | sdks/python | Text send, session list, webhook list |
| .NET 8+ | sdks/dotnet/RelayWA | Text send, session list, webhook list |

All clients use existing documented HTTPS REST endpoints and session-bound Bearer authentication. Do not embed keys in browser or mobile applications. No production services, routing, worker, database, or deployment files are changed by these previews. Run language-specific tests and security reviews before publication.
