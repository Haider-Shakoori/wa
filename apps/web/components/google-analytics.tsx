'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { isIndexablePublicPath, normalizePublicPath } from '../lib/public-pages';
import {
  ANALYTICS_CONSENT_KEY, ANALYTICS_SETTINGS_CHANNEL, MARKETING_EVENT_CHANNEL,
  marketingEventNames, safeMarketingPageLocation, type MarketingEventDetail,
} from '../lib/marketing-events';

const measurementId = 'G-61Z26DFM1V';
type Consent = 'granted' | 'denied' | null;
type GtagWindow = Window & {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
};

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>(null);
  const [hydrated, setHydrated] = useState(false);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);
  const lastViewed = useRef('');
  const normalizedPath = pathname ? normalizePublicPath(pathname) : null;
  const isPublic = Boolean(normalizedPath && isIndexablePublicPath(normalizedPath));

  useEffect(() => {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    setConsent(stored === 'granted' || stored === 'denied' ? stored : null);
    setHydrated(true);
    const openSettings = () => setConsent(null);
    window.addEventListener(ANALYTICS_SETTINGS_CHANNEL, openSettings);
    return () => window.removeEventListener(ANALYTICS_SETTINGS_CHANNEL, openSettings);
  }, []);

  useEffect(() => {
    // Never report admin, tenant, authentication or checkout page views.
    (window as unknown as Record<string, boolean>)[`ga-disable-${measurementId}`] = !isPublic || consent !== 'granted';
  }, [isPublic, consent]);

  useEffect(() => {
    if (!ready || !isPublic || !normalizedPath || consent !== 'granted') return;
    const pageLocation = safeMarketingPageLocation(window.location);
    if (lastViewed.current === pageLocation) return;
    lastViewed.current = pageLocation;
    // GA4 auto page views are disabled, including Next.js SPA transitions.
    (window as GtagWindow).gtag?.('event', 'page_view', {
      page_path: normalizedPath,
      page_location: pageLocation,
      page_title: document.title,
    });
  }, [ready, consent, isPublic, normalizedPath]);

  useEffect(() => {
    function onMarketingEvent(event: Event) {
      if (consent !== 'granted' || !ready || !isPublic) return;
      const detail = (event as CustomEvent<MarketingEventDetail>).detail;
      if (!detail || !marketingEventNames.includes(detail.event) ||
        !normalizedPath || detail.page_path !== normalizedPath) return;
      const allowed: Record<string, string> = {
        page_path: normalizedPath,
        page_location: safeMarketingPageLocation(window.location),
      };
      if (detail.cta_position && ['header', 'hero', 'final', 'pricing', 'footer'].includes(detail.cta_position)) {
        allowed.cta_position = detail.cta_position;
      }
      if (detail.plan_code && ['starter', 'growth', 'plus', 'scale'].includes(detail.plan_code)) {
        allowed.plan_code = detail.plan_code;
      }
      (window as GtagWindow).gtag?.('event', detail.event, allowed);
    }
    window.addEventListener(MARKETING_EVENT_CHANNEL, onMarketingEvent);
    return () => window.removeEventListener(MARKETING_EVENT_CHANNEL, onMarketingEvent);
  }, [consent, ready, isPublic, normalizedPath]);

  function choose(value: 'granted' | 'denied') {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    setConsent(value);
    if (value === 'denied') {
      (window as unknown as Record<string, boolean>)[`ga-disable-${measurementId}`] = true;
      lastViewed.current = '';
    }
  }

  if (!isPublic) return null;
  return (
    <>
      {hydrated && !consent && <aside className="rw-analytics-consent" role="region"
        aria-label="Analytics preferences"
        style={{ position: 'fixed', bottom: 12, left: 12, right: 12, zIndex: 1000,
          maxWidth: 640, margin: '0 auto', padding: 16, borderRadius: 14,
          background: '#161e24', color: '#fff', border: '1px solid #445563',
          boxShadow: '0 10px 32px rgba(0,0,0,.4)' }}>
        <p style={{margin:'0 0 10px'}}>Help improve RelayWA: allow optional analytics on public pages?
          No WhatsApp messages, customer details or private workspace URLs are shared.</p>
        <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
          <button type="button" onClick={() => choose('granted')} className="rw-button">Allow analytics</button>
          <button type="button" onClick={() => choose('denied')} className="rw-button secondary">Decline</button>
        </div>
      </aside>}
      {consent === 'granted' && <Script
        id="relaywa-ga4"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        onReady={() => {
          if (!initialized.current) {
            const global = window as GtagWindow;
            global.dataLayer ??= [];
            global.gtag = (...args: unknown[]) => { global.dataLayer?.push(args); };
            global.gtag('js', new Date());
            global.gtag('config', measurementId, { send_page_view: false });
            initialized.current = true;
          }
          setReady(true);
        }}
      />}
    </>
  );
}
