/**
 * cPanel uses a separate Passenger app for NestJS. Next.js proxies /api to it
 * so browser auth, OAuth callbacks and existing API URLs remain same-origin.
 *
 * The value is resolved at Next build time, NOT on every request.
 */
export function configuredProxyOrigin(value) {
  if (value === undefined || value === null || value.trim() === '') return null;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('RELAYWA_API_UPSTREAM must be a valid HTTPS origin');
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname ||
      parsed.username || parsed.password || parsed.pathname !== '/' ||
      parsed.search || parsed.hash) {
    throw new Error('RELAYWA_API_UPSTREAM must be a bare HTTPS origin (no path, credentials or query)');
  }
  return parsed.origin;
}
