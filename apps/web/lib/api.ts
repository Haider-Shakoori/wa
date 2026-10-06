export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

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
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? `Request failed with HTTP ${response.status}`);
  }
  return response.json();
}
