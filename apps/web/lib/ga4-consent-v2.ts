/**
 * Google Consent Mode v2, BASIC implementation for public RelayWA pages.
 *
 * Do not load Google's script before analytics opt-in. A denied visitor must
 * not cause a Google tag load, cookieless ping or a marketing event.
 * All advertising signals stay denied even when analytics is accepted.
 */
export type AnalyticsConsent = 'granted' | 'denied';
export type ConsentTarget = {
  dataLayer?: unknown[][];
  gtag?: (...args: unknown[]) => void;
};

export const deniedConsentV2 = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
} as const;

export function consentV2State(consent: AnalyticsConsent) {
  return {
    ...deniedConsentV2,
    analytics_storage: consent,
  };
}

/**
 * Execute BEFORE rendering/loading the Google script (including for visitors
 * who already accepted on a previous visit). The initial default always denies.
 */
export function initializeConsentV2(target: ConsentTarget, measurementId: string) {
  target.dataLayer ??= [];
  target.gtag ??= (...args: unknown[]) => { target.dataLayer?.push(args); };
  target.gtag('consent', 'default', { ...deniedConsentV2 });
  target.gtag('set', 'ads_data_redaction', true);
  target.gtag('set', 'allow_ad_personalization_signals', false);
  target.gtag('js', new Date());
  // Disable automatic page views so only our approved public route list emits.
  target.gtag('config', measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
}

export function updateConsentV2(target: ConsentTarget, consent: AnalyticsConsent) {
  // The Google tag has not been loaded for a fresh denied visitor. Do nothing.
  target.gtag?.('consent', 'update', consentV2State(consent));
}
