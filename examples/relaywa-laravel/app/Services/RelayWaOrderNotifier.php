<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Laravel 11/12 sample: send only after customer opt-in.
 * Add 'relaywa' => ['url' => env('RELAYWA_API_BASE', 'https://relaywa.com/api'),
 * 'session_key' => env('RELAYWA_SESSION_KEY')] to config/services.php.
 * Do not call from a Blade view, browser or public mobile client.
 */
final class RelayWaOrderNotifier
{
    public function sendReadyOrder(int $orderId, string $recipient): array
    {
        if (! preg_match('/^\d{7,32}$/D', $recipient)) {
            throw new RuntimeException('Use a digit-only international recipient number.');
        }

        $base = rtrim((string) config('services.relaywa.url'), '/');
        $key = (string) config('services.relaywa.session_key');
        if (! str_starts_with($base, 'https://') || $key === '') {
            throw new RuntimeException('Configure HTTPS RelayWA API base and server-side session key.');
        }

        // Reuse this ID for a single order-ready business event. Never mint
        // another ID on an uncertain timeout or 503 response.
        $clientMessageId = "order-{$orderId}-ready-v1";

        $response = Http::withToken($key)
            ->acceptJson()
            ->timeout(30)
            ->post($base.'/send-message', [
                'to' => $recipient,
                'text' => "Your order #{$orderId} is ready.",
                'clientMessageId' => $clientMessageId,
            ]);

        // 401 = invalid/revoked credentials, 403 = missing scope/authorization,
        // 409 = disconnected session. Do not retry those blindly.
        if (! $response->successful() || ! $response->json('success')) {
            throw new RuntimeException(
                'RelayWA did not accept send; HTTP '.$response->status().
                '. Inspect session/message status before any retry with '.$clientMessageId
            );
        }

        return (array) $response->json('data', []);
    }
}
