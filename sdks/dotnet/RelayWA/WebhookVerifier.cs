using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace RelayWA;

/// <summary>Verifies x-relaywa-signature against x-relaywa-timestamp and the raw HTTP body.</summary>
public static class WebhookVerifier
{
    public static bool Verify(string secret, string timestamp, string signature, byte[] rawBody, long? nowSeconds = null, long toleranceSeconds = 300)
    {
        if (string.IsNullOrEmpty(secret) || string.IsNullOrEmpty(timestamp) || string.IsNullOrEmpty(signature) || rawBody is null || toleranceSeconds < 0) return false;
        if (!Regex.IsMatch(timestamp, @"^[0-9]{10,15}$") || !Regex.IsMatch(signature, @"^sha256=[0-9a-f]{64}$")) return false;
        if (!long.TryParse(timestamp, out var sent)) return false;
        var now = nowSeconds ?? DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        if (sent > now && sent - now > toleranceSeconds || sent <= now && now - sent > toleranceSeconds) return false;
        var prefix = Encoding.UTF8.GetBytes(timestamp + ".");
        var payload = new byte[prefix.Length + rawBody.Length];
        Buffer.BlockCopy(prefix, 0, payload, 0, prefix.Length);
        Buffer.BlockCopy(rawBody, 0, payload, prefix.Length, rawBody.Length);
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), payload);
        var supplied = Convert.FromHexString(signature.Substring(7));
        return CryptographicOperations.FixedTimeEquals(expected, supplied);
    }
}
