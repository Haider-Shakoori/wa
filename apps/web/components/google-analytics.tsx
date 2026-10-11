'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { initializeConsentV2, updateConsentV2, type ConsentTarget } from '../lib/ga4-consent-v2';
import { isIndexablePublicPath, normalizePublicPath } from '../lib/public-pages';
import {
  ANALYTICS_CONSENT_KEY, ANALYTICS_SETTINGS_CHANNEL, MARKETING_EVENT_CHANNEL,
  marketingEventNames, safeMarketingPageLocation, type MarketingEventDetail,
} from '../lib/marketing-events';

const measurementId = 'G-61Z26DFM1V';
type Consent = 'granted' | 'denied' | null;
type GtagWindow = Window & ConsentTarget;

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>(null);
  const [hydrated, setHydrated] = useState(false);
  const [ready, setReady] = useState(false);
  // The tag cannot enter the DOM before Consent Mode v2 defaults are queued.
  const [tagEnabled, setTagEnabled] = useState(false);
  const initialized = useRef(false);
  const lastViewed = useRef('');
  const normalizedPath = pathname ? normalizePublicPath(pathname) : null;
  const isPublic = Boolean(normalizedPath && isIndexablePublicPath(normalizedPath));

  useEffect(() => {
    const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    setConsent(stored === 'granted' || stored === 'denied' ? stored : null);
    setHydrated(true);
    const openSettings = () => {
      const global = window as GtagWindow;
      (global as unknown as Record<string, boolean>)[`ga-disable-${measurementId}`] = true;
      if (initialized.current) updateConsentV2(global, 'denied');
      setConsent(null);
      setTagEnabled(false);
      setReady(false);
      lastViewed.current = '';
    };
    window.addEventListener(ANALYTICS_SETTINGS_CHANNEL, openSettings);
    return () => window.removeEventListener(ANALYTICS_SETTINGS_CHANNEL, openSettings);
  }, []);

  useEffect(() => {
    const global = window as GtagWindow;
    // Explicitly disable collection outside approved public pages.
    (global as unknown as Record<string, boolean>)[`ga-disable-${measurementId}`] = !isPublic || consent !== 'granted';
    if (!isPublic || consent !== 'granted') {
      if (initialized.current) updateConsentV2(global, 'denied');
      setTagEnabled(false);
      setReady(false);
      lastViewed.current = '';
      return;
    }

    // BASIC mode: initialize the default denied state BEFORE <Script> mounts.
    // Returning users with stored permission still get the denied default
    // followed by a specific analytics-only grant, never advertising consent.
    if (!initialized.current) {
      initializeConsentV2(global, measurementId);
      initialized.current = true;
    }
    updateConsentV2(global, 'granted');
    setTagEnabled(true);
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
    // On an existing session this takes effect synchronously, before rerender.
    if (initialized.current) updateConsentV2(window as GtagWindow, value);
    if (value === 'denied') {
      (window as unknown as Record<string, boolean>)[`ga-disable-${measurementId}`] = true;
      lastViewed.current = '';
    }
    setConsent(value);
  }

  if (!isPublic) return null;
  return (
    <>
      {hydrated && !consent && <aside className="rw-analytics-consent" role="region"
        aria-label="Analytics preferences"
        style={{ position: 'fixed', bottom: 12, left: 12, right: 12, zIndex: 1000,
          maxWidth: 640, maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto',
          boxSizing: 'border-box', margin: '0 auto', padding: 16, borderRadius: 14,
          background: '#161e24', color: '#fff', border: '1px solid #445563',
          boxShadow: '0 10px 32px rgba(0,0,0,.4)' }}>
        <p style={{margin:'0 0 10px'}}>Help improve RelayWA: allow optional Google Analytics on public pages?
          No WhatsApp messages, customer details or private workspace URLs are shared.</p>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10}}>
          <button type="button" onClick={() => choose('granted')} className="rw-button"
            style={{minHeight:44, position:'relative', zIndex:1}}>Allow analytics</button>
          <button type="button" onClick={() => choose('denied')} className="rw-button secondary"
            style={{minHeight:44, position:'relative', zIndex:1}}>Decline</button>
        </div>
      </aside>}
      {consent === 'granted' && tagEnabled && <Script
        id="relaywa-ga4"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        onReady={() => {
          // Initialization and denied defaults were queued before loading this script.
          setReady(true);
        }}
      />}
    </>
  );
}
