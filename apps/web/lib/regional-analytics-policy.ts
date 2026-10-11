/**
 * Consent required for EEA (EU 27 + Iceland, Liechtenstein, Norway),
 * the United Kingdom and Switzerland.
 *
 * Only call this on a country code resolved from the trusted, server-side
 * offline GeoIP database, never a browser-supplied country or language.
 * If country is unknown, fail closed (consent).
 */
export type RegionalAnalyticsPolicy = 'auto' | 'consent';

export const consentRequiredCountries = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI',
  'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'UK', 'CH',
]);

export function resolveRegionalAnalyticsPolicy(country: string | null | undefined): RegionalAnalyticsPolicy {
  const code = (country ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || ['ZZ','XX','T1','A1','AP','EU'].includes(code)) return 'consent';
  return consentRequiredCountries.has(code) ? 'consent' : 'auto';
}
