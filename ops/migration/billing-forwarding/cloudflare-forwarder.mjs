/**
 * Cloudflare Worker helper. Call ONLY after verifying Stripe's original
 * stripe-signature against the raw request body. No Stripe secret is needed
 * by the receiving VPS API.
 *
 * Set BILLING_FORWARD_URL to the HTTPS VPS receiver and
 * BILLING_FORWARD_SECRET to the same 32+ character secret on both sides.
 * Return a non-2xx webhook response if this throws, so Stripe retries.
 */
export async function forwardVerifiedStripeEvent(event, env, fetchImpl = fetch) {
  const url = env.BILLING_FORWARD_URL;
  const secret = env.BILLING_FORWARD_SECRET;
  if (!url || !secret || secret.length < 32) throw Error('Billing forwarding is not configured');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash ||
      !parsed.pathname.endsWith('/api/billing/stripe/verified-event')) {
    throw Error('Invalid billing forwarding URL');
  }
  if (!event || typeof event.id !== 'string' || !event.type || !event.data?.object) {
    throw Error('Invalid verified Stripe event');
  }
  const body = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + body));
  const signature = 'sha256=' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-relaywa-timestamp': timestamp, 'x-relaywa-signature': signature },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Error('Billing forwarding failed with HTTP ' + response.status);
  return { forwarded: true };
}

/** Synchronize the pending order before returning a new Cloudflare checkout URL. */
export async function forwardPendingStripeCheckout(checkout, env, fetchImpl = fetch) {
  const url = env.BILLING_PENDING_CHECKOUT_URL;
  const secret = env.BILLING_FORWARD_SECRET;
  if (!url || !secret || secret.length < 32) throw Error('Pending checkout forwarding is not configured');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash ||
      !parsed.pathname.endsWith('/api/billing/stripe/pending-checkout')) throw Error('Invalid pending checkout URL');
  if (!checkout || !checkout.paymentId || !checkout.organizationId || !checkout.checkoutId) {
    throw Error('Invalid pending checkout payload');
  }
  const body = JSON.stringify(checkout);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + body));
  const signature = 'sha256=' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-relaywa-timestamp': timestamp, 'x-relaywa-signature': signature },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Error('Pending checkout forwarding failed with HTTP ' + response.status);
  return { synced: true };
}

[executed on device: businessos-dev-vps (9b1cdbf1-1a02-4fe8-9e81-8871c3eca22c)]