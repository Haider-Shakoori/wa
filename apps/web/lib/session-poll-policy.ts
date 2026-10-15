/** Keep dashboard polling efficient without slowing down QR pairing. */
export const CONNECTING_SESSION_POLL_MS = 4_000;
export const CONNECTED_SESSION_POLL_MS = 60_000;
export const MAX_SESSION_ERROR_BACKOFF_MS = 300_000;

export function nextSessionPollDelay(status: string, consecutiveFailures: number): number {
  if (consecutiveFailures > 0) {
    const exponent = Math.min(5, Math.max(0, consecutiveFailures - 1));
    return Math.min(MAX_SESSION_ERROR_BACKOFF_MS, 15_000 * (2 ** exponent));
  }
  return status === 'connected' ? CONNECTED_SESSION_POLL_MS : CONNECTING_SESSION_POLL_MS;
}
