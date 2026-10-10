<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

final class RelayWaWebhookController
{
    public function __invoke(Request $request): JsonResponse
    {
        $secret = (string) config('services.relaywa.webhook_secret');
        $timestamp = (string) $request->header('x-relaywa-timestamp', '');
        $signature = (string) $request->header('x-relaywa-signature', '');
        if ($secret === '' || ! preg_match('/^\d{10}$/D', $timestamp) ||
            abs(time() - (int) $timestamp) > 300 ||
            ! preg_match('/^sha256=[a-f0-9]{64}$/iD', $signature)) {
            return response()->json(['error' => 'Invalid signature or expired timestamp'], 401);
        }

        // Compute HMAC over timestamp + '.' + the EXACT raw HTTP body bytes,
        // before parsing JSON; don't hash decoded/re-encoded JSON.
        $raw = $request->getContent();
        $expected = 'sha256='.hash_hmac('sha256', $timestamp.'.'.$raw, $secret);
        if (! hash_equals($expected, $signature)) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $payload = json_decode($raw, true);
        if (! is_array($payload) || empty($payload['id']) || empty($payload['type'])) {
            return response()->json(['error' => 'Invalid event'], 400);
        }

        // Replace this cache-based illustration with a DB UNIQUE(event_id)
        // inbox + transactional job dispatch in production. ACK a duplicate.
        $first = Cache::add('relaywa-event:'.$payload['id'], true, now()->addDay());
        if ($first) {
            // Dispatch a queued job after committing your event inbox entry.
            // ProcessRelayWaEvent::dispatch($payload)->afterCommit();
        }
        return response()->json(['received' => true], 200);
    }
}
