import { isIndexablePublicPath, normalizePublicPath } from './public-pages';

/** Intentionally no custom free-text, account IDs, contact data or private paths. */
export const marketingEventNames = [
  'pricing_view', 'trial_cta_click', 'plan_select', 'docs_cta_click',
] as const;
export type MarketingEventName = (typeof marketingEventNames)[number];
export type MarketingEventDetail = {
  event: MarketingEventName;
  page_path: string;
  cta_position?: 'header' | 'hero' | 'final' | 'pricing' | 'footer';
  plan_code?: 'starter' | 'growth' | 'plus' | 'scale';
};

export const MARKETING_EVENT_CHANNEL = 'relaywa:marketing-event';
export const ANALYTICS_SETTINGS_CHANNEL = 'relaywa:analytics-settings';
export const ANALYTICS_CONSENT_KEY = 'relaywa_analytics_consent';

const safeCampaignKey = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']);
const safeCampaignValue = /^[a-zA-Z0-9_-]{1,48}$/;

/** Explicit safe UTM allowlist prevents private URL parameters reaching GA4. */
export function safeMarketingPageLocation(location: Pick<Location, 'origin' | 'pathname' | 'search'>): string {
  const path = normalizePublicPath(location.pathname);
  if (!isIndexablePublicPath(path)) return location.origin + '/';
  const filtered = new URLSearchParams();
  const input = new URLSearchParams(location.search);
  for (const [key, value] of input.entries()) {
    if (safeCampaignKey.has(key) && safeCampaignValue.test(value) && !filtered.has(key)) {
      filtered.set(key, value);
    }
  }
  return location.origin + path + (filtered.size ? '?' + filtered.toString() : '');
}

export function trackMarketingEvent(
  event: MarketingEventName,
  options: Pick<MarketingEventDetail, 'cta_position' | 'plan_code'> = {},
) {
  if (typeof window === 'undefined' || !isIndexablePublicPath(window.location.pathname)) return;
  if (!marketingEventNames.includes(event)) return;
  const detail: MarketingEventDetail = {
    event,
    page_path: normalizePublicPath(window.location.pathname),
  };
  if (options.cta_position && ['header', 'hero', 'final', 'pricing', 'footer'].includes(options.cta_position)) {
    detail.cta_position = options.cta_position;
  }
  if (options.plan_code && ['starter', 'growth', 'plus', 'scale'].includes(options.plan_code)) {
    detail.plan_code = options.plan_code;
  }
  window.dispatchEvent(new CustomEvent<MarketingEventDetail>(MARKETING_EVENT_CHANNEL, { detail }));
}
