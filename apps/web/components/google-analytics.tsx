'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { isIndexablePublicPath } from '../lib/public-pages';

// GA4 measurement IDs are public identifiers, not credentials.
// Reports require a separate, authenticated GA4 Data API integration.
const measurementId = 'G-61Z26DFM1V';

// Share the exact published-page allowlist with the XML sitemap and proxy.
// Private workspaces, auth, billing and message data must never be reported.

type GtagWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
};

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const initialized = useRef(false);
  const [ready, setReady] = useState(false);
  const normalizedPath = pathname && pathname.length > 1
    ? pathname.replace(/\/+$/, '')
    : pathname;
  const isPublic = Boolean(normalizedPath && isIndexablePublicPath(normalizedPath));

  // Google's documented disable switch is a second guard in case the
  // browser retains the tag after client-side navigation to private routes.
  useEffect(() => {
    (window as unknown as Record<string, boolean>)[`ga-disable-${measurementId}`] = !isPublic;
  }, [isPublic]);

  useEffect(() => {
    if (!ready || !isPublic || !normalizedPath) return;

    // Explicit SPA page views only: never send URL query parameters, which
    // might contain authentication or invitation tokens.
    (window as GtagWindow).gtag?.('event', 'page_view', {
      page_path: normalizedPath,
      page_location: window.location.origin + normalizedPath,
      page_title: document.title,
    });
  }, [ready, isPublic, normalizedPath]);

  if (!isPublic) return null;

  return (
    <Script
      id="relaywa-ga4"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
      onReady={() => {
        if (!initialized.current) {
          const global = window as GtagWindow;
          global.dataLayer ??= [];
          global.gtag = (...args: unknown[]) => {
            global.dataLayer?.push(args);
          };
          global.gtag('js', new Date());
          // Disable automatic page views to prevent double-counting and
          // send only the explicitly allowlisted public route transitions.
          global.gtag('config', measurementId, { send_page_view: false });
          initialized.current = true;
        }
        setReady(true);
      }}
    />
  );
}
