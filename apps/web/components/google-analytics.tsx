'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { initializeConsentV2, updateConsentV2, type ConsentTarget } from '../lib/ga4-consent-v2';
import { isIndexablePublicPath, normalizePublicPath } from '../lib/public-pages';
import {
  ANALYTICS_CONSENT_KEY, ANALYTICS_CHOICE_CHANGED_CHANNEL, MARKETING_EVENT_CHANNEL,
  marketingEventNames, safeMarketingPageLocation, type MarketingEventDetail,
} from '../lib/marketing-events';

const measurementId = 'G-61Z26DFM1V';
type Consent = 'granted' | 'denied' | null;
type GtagWindow = Window & ConsentTarget;

export default function GoogleAnalytics() {
  const pathname = usePathname();
  // Explicit visitor choice ALWAYS overrides the region policy.
  // A regional automatic grant is never persisted as an explicit opt-in.
  const [storedChoice, setStoredChoice] = useState<Consent>(null);
  const [regionPolicy, setRegionPolicy] = useState<'pending' | 'auto' | 'consent'>('pending');
  const consent: Consent = storedChoice ??
    (regionPolicy === 'auto' ? 'granted' : null);
  const [ready, setReady] = useState(false);
  // The tag cannot enter the DOM before Consent Mode v2 defaults are queued.
  const [tagEnabled, setTagEnabled] = useState(false);
  const initialized = useRef(false);
  const lastViewed = useRef('');
  const normalizedPath = pathname ? normalizePublicPath(pathname) : null;
  const isPublic = Boolean(normalizedPath && isIndexablePublicPath(normalizedPath));

  useEffect(() => {
    // Read explicit choices on mount and synchronize across tabs/navigation.
    // Never overwrite a previous refusal with an automatic regional grant.
    const refreshChoice = () => {
      const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
      setStoredChoice(stored === 'granted' || stored === 'denied' ? stored : null);
    };
    refreshChoice();
    window.addEventListener('storage', refreshChoice);
    window.addEventListener(ANALYTICS_CHOICE_CHANGED_CHANNEL, refreshChoice);
    return () => {
      window.removeEventListener('storage', refreshChoice);
      window.removeEventListener(ANALYTICS_CHOICE_CHANGED_CHANNEL, refreshChoice);
    };
  }, []);

  useEffect(() => {
    if (!isPublic) return;
    let active = true;
    const controller = new AbortController();
    // Any network error, missing route, timeout or malformed response leaves
    // GA4 disabled until a visitor voluntarily opts in via footer settings.
    const timeout = window.setTimeout(() => controller.abort(), 4000);
    void fetch('/analytics-policy', {
      method: 'GET', cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Analytics policy unavailable');
      const result: unknown = await response.json();
      const mode = typeof result === 'object' && result !== null && 'policy' in result
        ? (result as { policy: unknown }).policy : undefined;
      return mode === 'auto' ? 'auto' : 'consent';
    }).catch(() => 'consent' as const).then(mode => {
      if (active) setRegionPolicy(mode);
    }).finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isPublic]);

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

  if (!isPublic) return null;
  return (
    <>
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
