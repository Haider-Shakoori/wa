/**
 * Optional Search Console URL-prefix ownership token. It is not an OAuth
 * credential and never grants website/GA4 analytics access.
 *
 * DNS TXT remains preferred for domain-wide property verification.
 * Never try to substitute GA4's consent-gated script for this token.
 */
export function googleSiteVerificationToken(value?: string): string | undefined {
  if (value == null || !value.trim()) return undefined;
  const token = value.trim();
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(token)) {
    throw new Error('GOOGLE_SITE_VERIFICATION must contain only the exact Google HTML verification token');
  }
  return token;
}
