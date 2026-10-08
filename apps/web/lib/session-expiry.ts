// Single source of truth for browser login expiry and sign-out routing.
// WhatsApp sessions and organization API keys are never affected here.
export const ACCESS_TOKEN_KEY = 'relaywa_access_token';

export function loginDestination(pathname: string) {
  return pathname === '/platform' || pathname.startsWith('/platform/')
    ? '/platform/login' : '/login';
}

export function requiresLogin(pathname: string) {
  if (pathname === '/platform/login' || pathname === '/platform/mfa') return false;
  return pathname === '/platform' || pathname.startsWith('/platform/') ||
    pathname === '/dashboard' || pathname.startsWith('/dashboard/') ||
    pathname === '/whatsapp' || pathname.startsWith('/whatsapp/') ||
    pathname === '/subscription' || pathname.startsWith('/subscription/') ||
    pathname === '/settings' || pathname.startsWith('/settings/');
}

export function accessTokenExpiration(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload: unknown = JSON.parse(atob(normalized));
    if (!payload || typeof payload !== 'object' || !('exp' in payload)) return null;
    const expiresAt = (payload as { exp?: unknown }).exp;
    return typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt > 0
      ? expiresAt * 1000 : null;
  } catch { return null; }
}

export function expireBrowserSession(token?: string) {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname;
  const activeToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  // Ignore an old request's 401 after a new sign-in/credential replacement.
  if (token && activeToken !== token) return false;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem('relaywa_platform_mfa_ticket');
  if (requiresLogin(pathname)) {
    window.location.replace(loginDestination(pathname) + '?expired=1');
  }
  return true;
}
