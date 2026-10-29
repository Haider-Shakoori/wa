using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace RelayWA;

/// <summary>Server-side SDK preview. Never distribute session keys in apps.</summary>
public sealed class RelayWAClient
{
    private readonly HttpClient _http;
    public RelayWAClient(HttpClient http, string sessionKey, string baseUrl = "https://relaywa.com/api")
    {
        if (string.IsNullOrWhiteSpace(sessionKey)) throw new ArgumentException("Session key required", nameof(sessionKey));
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) throw new ArgumentException("HTTPS API base required", nameof(baseUrl));
        _http = http;
        _http.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", sessionKey);
    }
    public async Task<JsonElement> SendTextAsync(string to, string text, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(to) || string.IsNullOrWhiteSpace(text)) throw new ArgumentException("Recipient and text required");
        using var response = await _http.PostAsJsonAsync("send-message", new { to, text }, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
    }
    public Task<JsonElement> SessionsAsync(CancellationToken cancellationToken = default) => GetAsync("whatsapp-sessions", cancellationToken);
    public Task<JsonElement> WebhooksAsync(CancellationToken cancellationToken = default) => GetAsync("webhooks", cancellationToken);
    private async Task<JsonElement> GetAsync(string path, CancellationToken cancellationToken)
    {
        using var response = await _http.GetAsync(path, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
    }
}
