'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ACCESS_TOKEN_KEY, accessTokenExpiration, expireBrowserSession, requiresLogin } from '../lib/session-expiry';

/**
 * Protects idle tabs as well as navigation. Network 401 responses are handled
 * separately by api(); timers here are just inexpensive local JWT checks.
 */
export default function SessionExpiryWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    if (!requiresLogin(pathname)) return;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let lastToken = '';

    function validateSession() {
      if (expiryTimer) clearTimeout(expiryTimer);
      expiryTimer = undefined;
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (!token) {
        // A tab may be signed out from another tab while a protected page is open.
        expireBrowserSession();
        return;
      }
      lastToken = token;
      const expiresAt = accessTokenExpiration(token);
      if (expiresAt === null) {
        // Legacy/malformed tokens should not grant indefinite dashboard access;
        // the server also validates signature and account membership.
        expireBrowserSession(token);
        return;
      }
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        expireBrowserSession(token);
        return;
      }
      // Browser setTimeout has a ~24.8-day cap. Recheck long-lived tokens.
      expiryTimer = setTimeout(validateSession, Math.min(remaining + 50, 2_147_000_000));
    }

    function storageChanged(event: StorageEvent) {
      if (event.key === ACCESS_TOKEN_KEY && event.newValue !== lastToken) validateSession();
    }
    function visibilityChanged() {
      if (!document.hidden) validateSession();
    }
    validateSession();
    window.addEventListener('focus', validateSession);
    window.addEventListener('pageshow', validateSession);
    window.addEventListener('storage', storageChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      if (expiryTimer) clearTimeout(expiryTimer);
      window.removeEventListener('focus', validateSession);
      window.removeEventListener('pageshow', validateSession);
      window.removeEventListener('storage', storageChanged);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [pathname]);

  return null;
}
