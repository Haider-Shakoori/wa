# RelayWA .NET SDK (preview)

Target: .NET 8. **Not published to NuGet.** Inject `HttpClient` and use a server-side session key.

Implemented: text/media/advanced messaging, session reads and lifecycle, directory reads, webhook management and signature verification.

Build: `dotnet build sdks/dotnet/RelayWA/RelayWA.csproj`.

Session lifecycle calls may change real WhatsApp sessions. Do not automatically retry sends or state-changing requests after ambiguous timeouts. Keep keys out of mobile and browser applications. See `sdks/README.md` for release limitations.
