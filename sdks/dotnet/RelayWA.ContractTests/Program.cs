using System.Net;
using System.Text.Json;
using RelayWA;

var handler = new CaptureHandler();
using var http = new HttpClient(handler);
var sdk = new RelayWAClient(http, "offline-test");
await sdk.CreateSessionAsync("Demo");
await sdk.UpdateSessionAsync("a/b", name: "Renamed");
await sdk.ConnectSessionAsync("a/b");
await sdk.RestartSessionAsync("a/b");
await sdk.DisconnectSessionAsync("a/b");
await sdk.DeleteSessionAsync("a/b");

var expected = new (HttpMethod Method, string Path)[]
{
    (HttpMethod.Post, "/api/whatsapp-sessions"),
    (HttpMethod.Patch, "/api/whatsapp-sessions/a%2Fb"),
    (HttpMethod.Post, "/api/whatsapp-sessions/a%2Fb/connect"),
    (HttpMethod.Post, "/api/whatsapp-sessions/a%2Fb/restart"),
    (HttpMethod.Post, "/api/whatsapp-sessions/a%2Fb/disconnect"),
    (HttpMethod.Delete, "/api/whatsapp-sessions/a%2Fb")
};
if (handler.Calls.Count != expected.Length) throw new Exception("Incorrect request count");
for (int i = 0; i < expected.Length; i++)
{
    var call = handler.Calls[i];
    if (call.Method != expected[i].Method || call.Path != expected[i].Path || call.Auth != "Bearer offline-test")
        throw new Exception($"Unexpected request at {i}: {call.Method} {call.Path}");
}
using (var created = JsonDocument.Parse(handler.Calls[0].Body!))
    if (created.RootElement.GetProperty("name").GetString() != "Demo") throw new Exception("Create payload mismatch");
using (var updated = JsonDocument.Parse(handler.Calls[1].Body!))
    if (updated.RootElement.GetProperty("name").GetString() != "Renamed") throw new Exception("Update payload mismatch");

var count = handler.Calls.Count;
await Rejects(() => sdk.CreateSessionAsync("x"));
await Rejects(() => sdk.UpdateSessionAsync("id", phoneHint: new string('x', 41)));
await Rejects(() => sdk.ConnectSessionAsync(" "));
await Rejects(() => sdk.DeleteSessionAsync(""));
if (handler.Calls.Count != count) throw new Exception("Invalid input reached transport");
Console.WriteLine("RelayWA .NET offline session contracts passed");

static async Task Rejects(Func<Task> operation)
{
    try { await operation(); }
    catch (ArgumentException) { return; }
    throw new Exception("Expected argument validation");
}

sealed class CaptureHandler : HttpMessageHandler
{
    public List<(HttpMethod Method, string Path, string? Body, string? Auth)> Calls { get; } = new();
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Calls.Add((request.Method, request.RequestUri!.AbsolutePath,
            request.Content is null ? null : await request.Content.ReadAsStringAsync(ct),
            request.Headers.Authorization?.ToString()));
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{}") };
    }
}
