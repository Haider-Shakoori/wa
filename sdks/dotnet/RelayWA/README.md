# RelayWA .NET SDK (preview)

**Unpublished source preview** — .NET 8+.

## Local installation
Build with `dotnet pack sdks/dotnet/RelayWA/RelayWA.csproj -c Release` from the repository root. Install the resulting `RelayWA.Sdk` NuGet package using a local package source. It is not yet published to NuGet.org.

## Server-side usage
```csharp
using RelayWA;
using System.Net.Http;

using var http = new HttpClient();
var client = new RelayWAClient(http,
    Environment.GetEnvironmentVariable("RELAYWA_SESSION_KEY")
        ?? throw new InvalidOperationException("Missing session key"));
// No network call occurs until an API method is invoked.
```

Keep keys in server-side secret storage. Avoid automatic retries of non-idempotent operations. See [SDK overview](../../README.md) and [release checklist](../../RELEASE_CHECKLIST.md).
