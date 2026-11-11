/**
 * Google Analytics service-account OAuth client for Node 22+ and Cloudflare Workers.
 * No Node built-ins, filesystem, Buffer, or logging. In Workers, pass
 * env.GA4_SERVICE_ACCOUNT_JSON from a secret binding in the authenticated handler.
 */
const EMAIL = 'relaywa-analytics@relaywa-analytics.iam.gserviceaccount.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type Ga4ServiceAccount = {
  type: 'service_account';
  client_email: string;
  private_key: string;
};

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonBase64Url(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export function parseGa4ServiceAccount(raw: string): Ga4ServiceAccount {
  if (!raw || raw.length > 32_768) throw new Error('GA4 credential missing or oversized');
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') throw new Error('GA4 credential must be a JSON object');
  const data = parsed as Record<string, unknown>;
  if (data.type !== 'service_account' || data.client_email !== EMAIL ||
      typeof data.private_key !== 'string' ||
      !data.private_key.includes('-----BEGIN PRIVATE KEY-----') ||
      !data.private_key.includes('-----END PRIVATE KEY-----')) {
    throw new Error('Invalid RelayWA GA4 service-account credential');
  }
  return { type: 'service_account', client_email: EMAIL, private_key: data.private_key };
}

export async function getGa4AccessToken(raw: string): Promise<{ accessToken: string; expiresIn: number }> {
  const credentials = parseGa4ServiceAccount(raw);
  const stripped = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(stripped), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${jsonBase64Url({ alg: 'RS256', typ: 'JWT' })}.${jsonBase64Url({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: TOKEN_URL,
    iat: now, exp: now + 3600,
  })}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned).buffer as ArrayBuffer,
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('Google OAuth token request failed');
  const token: unknown = await response.json();
  if (!token || typeof token !== 'object' ||
      typeof (token as { access_token?: unknown }).access_token !== 'string') {
    throw new Error('Google OAuth did not return an access token');
  }
  const data = token as { access_token: string; expires_in?: number };
  return {
    accessToken: data.access_token,
    expiresIn: Math.min(Math.max(data.expires_in ?? 3600, 120), 3600),
  };
}
