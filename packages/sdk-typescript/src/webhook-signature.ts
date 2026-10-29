/** Verify RelayWA's worker HMAC-SHA256 signature over timestamp + '.' + raw body. */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookVerificationInput = {
  secret: string;
  timestamp: string;
  signature: string;
  rawBody: string | Uint8Array;
  nowSeconds?: number;
  toleranceSeconds?: number;
};

export function verifyWebhookSignature(input: WebhookVerificationInput): boolean {
  const { secret, timestamp, signature, rawBody } = input;
  const tolerance = input.toleranceSeconds ?? 300;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!secret || !/^\d{10,}$/.test(timestamp) || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(tolerance) || tolerance < 0) return false;
  const sent = Number(timestamp);
  if (!Number.isSafeInteger(sent) || Math.abs(now - sent) > tolerance) return false;
  const mac = createHmac('sha256', secret)
    .update(timestamp + '.')
    .update(rawBody)
    .digest();
  const received = Buffer.from(signature.slice(7), 'hex');
  return received.length === mac.length && timingSafeEqual(received, mac);
}
