// The browser API always lives under /api on the canonical RelayWA origin.
// Accept either an origin or an /api URL, without routing auth requests to Next.js.
import { expireBrowserSession } from './session-expiry';

const configuredApiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api').replace(/\/$/, '');
export const API_BASE = configuredApiBase.endsWith('/api') ? configuredApiBase : `${configuredApiBase}/api`;

export async function api<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    if (response.status === 401 && token) {
      expireBrowserSession(token);
    }
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Request failed with HTTP ${response.status}`);
  }
  return response.json();
}
