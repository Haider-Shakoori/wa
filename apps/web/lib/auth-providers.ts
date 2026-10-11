// Google and GitHub buttons share one public configuration request.
// Only public OAuth client IDs and enabled flags are returned (no secrets).
import { api } from './api';

export type AuthProviders = {
  email?: { enabled?: boolean };
  google?: { enabled?: boolean; clientId?: string };
  github?: { enabled?: boolean; clientId?: string };
};

const CACHE_MS = 15_000;
let cached: { value: AuthProviders; loadedAt: number } | null = null;
let pending: Promise<AuthProviders> | null = null;

export function getAuthProviders(): Promise<AuthProviders> {
  if (cached && Date.now() - cached.loadedAt < CACHE_MS) {
    return Promise.resolve(cached.value);
  }
  if (pending) return pending;
  pending = api<AuthProviders>('/auth/providers')
    .then((value) => {
      cached = { value, loadedAt: Date.now() };
      return value;
    }).finally(() => {
      pending = null; // Retry on transient network/server errors.
    });
  return pending;
}
