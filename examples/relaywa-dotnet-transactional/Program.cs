// RelayWA QR-linked WhatsApp Web session API; NOT the official Meta Cloud API.
// .NET 8+ self-contained demo; no NuGet dependencies.
// Test without a WhatsApp account: dotnet run --project examples/relaywa-dotnet-transactional -- --self-test
// Keep API credentials on the server. Do not embed them in a desktop/mobile app.
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

if (args.Contains("--self-test", StringComparer.Ordinal))
{
    await SelfTest.RunAsync();
}
else
{
    Console.WriteLine("Use --self-test. In your server app, inject HttpClient into RelayWaOrderNotifier.");
    Console.WriteLine("Set RELAYWA_SESSION_KEY in server configuration. Never use client-side secrets.");
}

public sealed class RelayWaSendRejectedException(HttpStatusCode status)
    : Exception($"RelayWA rejected the request: HTTP {(int)status}; investigate before retry.")
{
    public HttpStatusCode Status { get; } = status;
}
public sealed class RelayWaSendUncertainException(string clientMessageId, Exception cause)
    : Exception($"Send outcome uncertain for {clientMessageId}: inspect status before reusing the SAME key.", cause);

public sealed class RelayWaOrderNotifier(HttpClient http, string sessionKey,
    string apiBase = "https://relaywa.com/api")
{
    private readonly string _key = !string.IsNullOrWhiteSpace(sessionKey)
        ? sessionKey : throw new ArgumentException("Server-side key is required");
    private readonly string _base = Uri.TryCreate(apiBase, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps && uri.UserInfo.Length == 0
        ? apiBase.TrimEnd('/') : throw new ArgumentException("HTTPS API base required");

    public async Task<string> SendReadyAsync(string orderId, string recipient,
        CancellationToken cancellationToken = default)
    {
        if (!Regex.IsMatch(orderId, @"^[a-zA-Z0-9_-]{1,75}$"))
            throw new ArgumentException("Invalid order identifier");
        if (!Regex.IsMatch(recipient, @"^[0-9]{7,32}$"))
            throw new ArgumentException("Use international recipient digits only");

        var eventId = $"order-{orderId}-ready-v1";
        using var request = new HttpRequestMessage(HttpMethod.Post, _base + "/send-message");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _key);
        request.Content = new StringContent(JsonSerializer.Serialize(new
        {
            to = recipient, text = $"Your order {orderId} is ready.",
            clientMessageId = eventId
        }), Encoding.UTF8, "application/json");

        HttpResponseMessage response;
        try
        {
            // Exactly ONE HTTP attempt. A timeout may occur AFTER WhatsApp accepted the send.
            response = await http.SendAsync(request, cancellationToken);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException)
        {
            throw new RelayWaSendUncertainException(eventId, error);
        }
        using (response)
        {
            if (!response.IsSuccessStatusCode)
                throw new RelayWaSendRejectedException(response.StatusCode);
            try
            {
                using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                if (!body.RootElement.TryGetProperty("success", out var success)
                    || success.ValueKind != JsonValueKind.True
                    || !body.RootElement.TryGetProperty("data", out var data)
                    || !data.TryGetProperty("id", out var id)
                    || id.ValueKind != JsonValueKind.String)
                    throw new JsonException("No successful message ID in response");
                return id.GetString()!;
            }
            catch (JsonException error)
            {
                // Response was HTTP success but unreadable; do NOT send again with a fresh key.
                throw new RelayWaSendUncertainException(eventId, error);
            }
        }
    }
}

public static class RelayWaWebhook
{
    public static bool Verify(ReadOnlySpan<byte> rawBody, IReadOnlyDictionary<string, string> headers,
        string secret, DateTimeOffset utcNow)
    {
        if (string.IsNullOrEmpty(secret)) return false;
        string Header(string name) =>
            headers.FirstOrDefault(pair => string.Equals(pair.Key, name, StringComparison.OrdinalIgnoreCase)).Value ?? "";
        var timestamp = Header("x-relaywa-timestamp");
        var signature = Header("x-relaywa-signature");
        if (!Regex.IsMatch(timestamp, @"^[0-9]{10}$") ||
            !long.TryParse(timestamp, out var seconds) ||
            Math.Abs(utcNow.ToUnixTimeSeconds() - seconds) > 300 ||
            !Regex.IsMatch(signature, @"^sha256=[0-9a-fA-F]{64}$")) return false;

        // SHA256(secret, ASCII timestamp + '.' + exact original HTTP body bytes).
        var prefix = Encoding.ASCII.GetBytes(timestamp + ".");
        byte[] signed = new byte[prefix.Length + rawBody.Length];
        prefix.CopyTo(signed, 0);
        rawBody.CopyTo(signed.AsSpan(prefix.Length));
        byte[] expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), signed);
        byte[] submitted = Convert.FromHexString(signature[7..]);
        return CryptographicOperations.FixedTimeEquals(expected, submitted);
    }
}

internal sealed class FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> reply) : HttpMessageHandler
{
    public int Calls { get; private set; }
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Calls++;
        return Task.FromResult(reply(request));
    }
}

internal static class SelfTest
{
    private static void Check(bool valid, string message)
    {
        if (!valid) throw new Exception("Failed test: " + message);
    }
    public static async Task RunAsync()
    {
        var handler = new FakeHandler(request =>
        {
            Check(request.RequestUri?.ToString() == "https://relaywa.com/api/send-message", "absolute HTTPS endpoint");
            Check(request.Headers.Authorization?.ToString() == "Bearer fixture-key", "Bearer authorization");
            string body = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            using var json = JsonDocument.Parse(body);
            Check(json.RootElement.GetProperty("clientMessageId").GetString() == "order-123-ready-v1",
                "stable idempotency key");
            Check(json.RootElement.GetProperty("to").GetString() == "12025550123", "recipient");
            return new HttpResponseMessage(HttpStatusCode.OK) {
                Content = new StringContent("{\"success\":true,\"data\":{\"id\":\"message-1\"}}")
            };
        });
        using var http = new HttpClient(handler);
        var sender = new RelayWaOrderNotifier(http, "fixture-key");
        var id = await sender.SendReadyAsync("123", "12025550123");
        Check(id == "message-1" && handler.Calls == 1, "one successful request");
        try
        {
            await sender.SendReadyAsync("123", "+1202");
            throw new Exception("Invalid recipient accepted");
        }
        catch (ArgumentException) { }

        var rejected = new FakeHandler(_ => new HttpResponseMessage(HttpStatusCode.Conflict));
        using (var client = new HttpClient(rejected))
        {
            try
            {
                await new RelayWaOrderNotifier(client, "fixture-key").SendReadyAsync("123", "12025550123");
                throw new Exception("Expected 409");
            }
            catch (RelayWaSendRejectedException ex)
            {
                Check(ex.Status == HttpStatusCode.Conflict && rejected.Calls == 1, "no retry on 409");
            }
        }

        var unreadable = new FakeHandler(_ => new HttpResponseMessage(HttpStatusCode.OK) {
            Content = new StringContent("malformed")
        });
        using (var client = new HttpClient(unreadable))
        {
            try
            {
                await new RelayWaOrderNotifier(client, "fixture-key").SendReadyAsync("123", "12025550123");
                throw new Exception("Expected uncertain result");
            }
            catch (RelayWaSendUncertainException)
            {
                Check(unreadable.Calls == 1, "no retry on unparseable accepted response");
            }
        }

        var now = DateTimeOffset.FromUnixTimeSeconds(1791378000);
        byte[] raw = Encoding.UTF8.GetBytes("{\n  \"id\":\"evt1\",\"type\":\"message.received\"}\n");
        string timestamp = now.ToUnixTimeSeconds().ToString();
        byte[] signed = Encoding.UTF8.GetBytes(timestamp + ".").Concat(raw).ToArray();
        string signature = "sha256=" + Convert.ToHexString(
            HMACSHA256.HashData(Encoding.UTF8.GetBytes("fixture-secret"), signed)).ToLowerInvariant();
        var headers = new Dictionary<string, string> {
            ["X-RelayWA-Timestamp"] = timestamp, ["X-RelayWA-Signature"] = signature
        };
        Check(RelayWaWebhook.Verify(raw, headers, "fixture-secret", now), "valid raw-body signature");
        Check(!RelayWaWebhook.Verify(Encoding.UTF8.GetBytes("{}"), headers, "fixture-secret", now),
            "modified bytes rejected");
        Check(!RelayWaWebhook.Verify(raw, headers, "wrong", now), "wrong secret rejected");
        Check(!RelayWaWebhook.Verify(raw, headers, "fixture-secret", now.AddSeconds(301)),
            "stale event rejected");
        headers["X-RelayWA-Signature"] = "sha256=invalid";
        Check(!RelayWaWebhook.Verify(raw, headers, "fixture-secret", now), "malformed signature rejected");
        Console.WriteLine("RelayWA .NET sample: all offline sender and webhook tests passed.");
    }
}
