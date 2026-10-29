<?php
declare(strict_types=1);
namespace RelayWA;

final class WebhookVerifier
{
    /** Verify the exact raw request body and the two x-relaywa-* headers. */
    public static function verify(string $secret, string $timestamp, string $signature, string $rawBody, ?int $nowSeconds = null, int $toleranceSeconds = 300): bool
    {
        if ($secret === '' || !preg_match('/^[0-9]{10,}$/D', $timestamp) || !preg_match('/^sha256=[a-f0-9]{64}$/D', $signature) || $toleranceSeconds < 0) return false;
        $now = $nowSeconds ?? time();
        if (strlen($timestamp) > 15 || abs($now - (int)$timestamp) > $toleranceSeconds) return false;
        $expected = 'sha256=' . hash_hmac('sha256', $timestamp . '.' . $rawBody, $secret);
        return hash_equals($expected, $signature);
    }
}
