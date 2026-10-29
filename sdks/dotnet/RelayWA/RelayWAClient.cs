using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace RelayWA;

/// <summary>Server-side SDK preview. Never distribute session keys in apps.</summary>
public sealed record MediaMessage(string To, string Url, string MimeType, long MediaSizeBytes,
    string? FileName = null, string? Caption = null, bool? VoiceNote = null, string? ClientMessageId = null);

public sealed record WebhookCreate(string Name, string Url, string[]? EventTypes = null);
public sealed record WebhookUpdate(string? Name = null, string? Url = null, string[]? EventTypes = null, bool? Enabled = null);

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
    private async Task<JsonElement> SendMediaAsync(string kind, MediaMessage media, CancellationToken cancellationToken)
    {
        var limit = kind switch { "image" => 16L * 1024 * 1024, "video" => 64L * 1024 * 1024,
            "audio" => 16L * 1024 * 1024, "document" => 100L * 1024 * 1024, _ => throw new ArgumentException("Invalid media type") };
        if (string.IsNullOrWhiteSpace(media.To) || media.To.Length < 7 || media.To.Length > 32) throw new ArgumentException("Invalid recipient");
        if (!Uri.TryCreate(media.Url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(uri.UserInfo)) throw new ArgumentException("Media URL must use HTTPS");
        if (string.IsNullOrWhiteSpace(media.MimeType)) throw new ArgumentException("mimeType is required");
        if (media.MediaSizeBytes < 1 || media.MediaSizeBytes > limit) throw new ArgumentException("Invalid media size");
        var payload = new Dictionary<string, object> { ["to"] = media.To, ["url"] = media.Url,
            ["mimeType"] = media.MimeType, ["mediaSizeBytes"] = media.MediaSizeBytes };
        if (media.FileName is not null) payload["fileName"] = media.FileName;
        if (media.Caption is not null) payload["caption"] = media.Caption;
        if (media.VoiceNote is not null) payload["voiceNote"] = media.VoiceNote.Value;
        if (media.ClientMessageId is not null) payload["clientMessageId"] = media.ClientMessageId;
        using var response = await _http.PostAsJsonAsync("send-" + kind, payload, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
    }
    public Task<JsonElement> SendImageAsync(MediaMessage media, CancellationToken ct = default) => SendMediaAsync("image", media, ct);
    public Task<JsonElement> SendVideoAsync(MediaMessage media, CancellationToken ct = default) => SendMediaAsync("video", media, ct);
    public Task<JsonElement> SendAudioAsync(MediaMessage media, CancellationToken ct = default) => SendMediaAsync("audio", media, ct);
    public Task<JsonElement> SendDocumentAsync(MediaMessage media, CancellationToken ct = default) => SendMediaAsync("document", media, ct);

    private async Task<JsonElement> SendActionAsync(string kind, object payload, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("send-" + kind, payload, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
    }
    public Task<JsonElement> SendLocationAsync(string to, double latitude, double longitude, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(to) || to.Length < 7 || to.Length > 32 || !double.IsFinite(latitude) || !double.IsFinite(longitude) || Math.Abs(latitude) > 90 || Math.Abs(longitude) > 180) throw new ArgumentException("Invalid location");
        return SendActionAsync("location", new { to, latitude, longitude }, ct);
    }
    public Task<JsonElement> SendContactAsync(string to, string displayName, string vcard, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(to) || to.Length < 7 || to.Length > 32 || string.IsNullOrEmpty(displayName) || displayName.Length > 160 || string.IsNullOrEmpty(vcard) || vcard.Length < 10 || vcard.Length > 12000) throw new ArgumentException("Invalid contact");
        return SendActionAsync("contact", new { to, displayName, vcard }, ct);
    }
    public Task<JsonElement> SendPollAsync(string to, string question, string[] options, int selectableCount, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(to) || to.Length < 7 || to.Length > 32 || string.IsNullOrEmpty(question) || question.Length > 255 || options is null || options.Length < 2 || options.Length > 12 || options.Any(x => x is null || x.Length > 100) || selectableCount < 1 || selectableCount > options.Length) throw new ArgumentException("Invalid poll");
        return SendActionAsync("poll", new { to, question, options, selectableCount }, ct);
    }
    public Task<JsonElement> SendReplyAsync(string to, string text, string quotedMessageId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(to) || to.Length < 7 || to.Length > 32 || string.IsNullOrEmpty(text) || text.Length > 4096 || string.IsNullOrEmpty(quotedMessageId) || quotedMessageId.Length > 180) throw new ArgumentException("Invalid reply");
        return SendActionAsync("reply", new { to, text, quotedMessageId }, ct);
    }
    public Task<JsonElement> SendReactionAsync(string to, string emoji, string targetMessageId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(to) || to.Length < 7 || to.Length > 32 || emoji is null || emoji.Length > 32 || string.IsNullOrEmpty(targetMessageId) || targetMessageId.Length > 180) throw new ArgumentException("Invalid reaction");
        return SendActionAsync("reaction", new { to, emoji, targetMessageId }, ct);
    }
    public Task<JsonElement> SessionsAsync(CancellationToken cancellationToken = default) => GetAsync("whatsapp-sessions", cancellationToken);
    private static string SessionPath(string id) => !string.IsNullOrWhiteSpace(id) ? "whatsapp-sessions/" + Uri.EscapeDataString(id) : throw new ArgumentException("Session ID required");
    private static void ValidateSessionInput(string? name, string? phoneHint, bool create)
    {
        if (create && name is null) throw new ArgumentException("Session name required");
        if (name is not null && (name.Length < 2 || name.Length > 120)) throw new ArgumentException("Invalid session name");
        if (phoneHint is not null && phoneHint.Length > 40) throw new ArgumentException("Invalid phone hint");
    }
    public async Task<JsonElement> CreateSessionAsync(string name, string? phoneHint = null, CancellationToken ct = default)
    {
        ValidateSessionInput(name, phoneHint, true);
        using var response = await _http.PostAsJsonAsync("whatsapp-sessions", new { name, phoneHint }, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
    }
    public async Task<JsonElement> UpdateSessionAsync(string id, string? name = null, string? phoneHint = null, CancellationToken ct = default)
    {
        var path = SessionPath(id);
        ValidateSessionInput(name, phoneHint, false);
        var payload = new Dictionary<string, string>();
        if (name is not null) payload["name"] = name;
        if (phoneHint is not null) payload["phoneHint"] = phoneHint;
        using var response = await _http.PatchAsJsonAsync(path, payload, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
    }
    private async Task<JsonElement> SessionActionAsync(string id, string action, CancellationToken ct)
    {
        using var response = await _http.PostAsync(SessionPath(id) + "/" + action, null, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
    }
    public Task<JsonElement> ConnectSessionAsync(string id, CancellationToken ct = default) => SessionActionAsync(id, "connect", ct);
    public Task<JsonElement> RestartSessionAsync(string id, CancellationToken ct = default) => SessionActionAsync(id, "restart", ct);
    public Task<JsonElement> DisconnectSessionAsync(string id, CancellationToken ct = default) => SessionActionAsync(id, "disconnect", ct);
    public async Task<JsonElement> DeleteSessionAsync(string id, CancellationToken ct = default)
    {
        using var response = await _http.DeleteAsync(SessionPath(id), ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
    }
    public Task<JsonElement> SessionAsync(string id, CancellationToken ct = default) => GetAsync(SessionPath(id), ct);
    public Task<JsonElement> SessionQrCodeAsync(string id, CancellationToken ct = default) => GetAsync(SessionPath(id) + "/qrcode", ct);
    public Task<JsonElement> SessionStatisticsAsync(string id, CancellationToken ct = default) => GetAsync(SessionPath(id) + "/statistics", ct);
    public Task<JsonElement> SessionLogsAsync(string id, CancellationToken ct = default) => GetAsync(SessionPath(id) + "/logs", ct);
    public Task<JsonElement> SessionMessagesAsync(string id, CancellationToken ct = default) => GetAsync(SessionPath(id) + "/messages", ct);
    public Task<JsonElement> SessionMessageAsync(string id, string messageId, CancellationToken ct = default) => GetAsync(SessionPath(id) + "/messages/" + (!string.IsNullOrWhiteSpace(messageId) ? Uri.EscapeDataString(messageId) : throw new ArgumentException("Message ID required")), ct);
    public Task<JsonElement> SessionContactsAsync(string id, CancellationToken ct = default) => GetAsync(SessionPath(id) + "/contacts", ct);
    public Task<JsonElement> SessionChatsAsync(string id, CancellationToken ct = default) => GetAsync(SessionPath(id) + "/chats", ct);
    public Task<JsonElement> SessionGroupsAsync(string id, CancellationToken ct = default) => GetAsync(SessionPath(id) + "/groups", ct);
    public Task<JsonElement> WebhooksAsync(CancellationToken cancellationToken = default) => GetAsync("webhooks", cancellationToken);
    private static string WebhookId(string id) => !string.IsNullOrWhiteSpace(id) ? Uri.EscapeDataString(id) : throw new ArgumentException("Webhook ID required");
    private static void ValidateWebhook(string? name, string? url, string[]? events)
    {
        if (name is not null && (name.Length < 2 || name.Length > 120)) throw new ArgumentException("Invalid webhook name");
        if (url is not null && (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(uri.UserInfo))) throw new ArgumentException("Webhook URL must use HTTPS");
        if (events is not null && (events.Length > 32 || events.Any(e => e is null || e.Length > 64))) throw new ArgumentException("Invalid webhook event types");
    }
    public async Task<JsonElement> CreateWebhookAsync(WebhookCreate input, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(input.Name) || string.IsNullOrEmpty(input.Url)) throw new ArgumentException("Webhook name and URL required");
        ValidateWebhook(input.Name, input.Url, input.EventTypes);
        using var response = await _http.PostAsJsonAsync("webhooks", input, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
    }
    public async Task<JsonElement> UpdateWebhookAsync(string id, WebhookUpdate input, CancellationToken ct = default)
    {
        var segment = WebhookId(id);
        ValidateWebhook(input.Name, input.Url, input.EventTypes);
        using var response = await _http.PatchAsJsonAsync("webhooks/" + segment, input, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
    }
    public async Task<JsonElement> DeleteWebhookAsync(string id, CancellationToken ct = default)
    {
        using var response = await _http.DeleteAsync("webhooks/" + WebhookId(id), ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: ct);
    }
    public Task<JsonElement> WebhookDeliveriesAsync(string id, CancellationToken ct = default) => GetAsync("webhooks/" + WebhookId(id) + "/deliveries", ct);

    private async Task<JsonElement> GetAsync(string path, CancellationToken cancellationToken)
    {
        using var response = await _http.GetAsync(path, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(cancellationToken: cancellationToken);
    }
}
