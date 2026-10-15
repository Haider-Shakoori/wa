import { API_BASE } from './api';
import { expireBrowserSession } from './session-expiry';

export type SessionStreamEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type StreamOptions = {
  sessionId: string;
  token: string;
  signal: AbortSignal;
  onOpen: () => void;
  onEvents: (events: SessionStreamEvent[]) => void;
};

/**
 * Authenticated streaming rather than EventSource: never put bearer tokens in URLs.
 * One open SSE stream replaces repeated public HTTP status requests.
 */
export async function watchSessionEvents(options: StreamOptions): Promise<void> {
  const { sessionId, token, signal, onOpen, onEvents } = options;
  const response = await fetch(
    API_BASE + '/whatsapp-sessions/' + encodeURIComponent(sessionId) + '/events',
    {
      headers: { authorization: 'Bearer ' + token, accept: 'text/event-stream' },
      cache: 'no-store',
      signal,
    },
  );
  if (response.status === 401) expireBrowserSession(token);
  if (!response.ok || !response.body ||
      !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error('Session event stream unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let frameData: string[] = [];
  onOpen();
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) throw new Error('Session event stream ended');
      pending += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, newline).replace(/\r$/, '');
        pending = pending.slice(newline + 1);
        if (line === '') {
          if (frameData.length) {
            try {
              const value: unknown = JSON.parse(frameData.join('\n'));
              if (Array.isArray(value)) {
                const events = value.filter((event): event is SessionStreamEvent =>
                  event !== null && typeof event === 'object' &&
                  typeof event.type === 'string' && typeof event.id === 'string');
                if (events.length) onEvents(events);
              }
            } catch {
              // An invalid frame must not terminate the connection or repeat requests.
            }
          }
          frameData = [];
        } else if (line.startsWith('data:')) {
          frameData.push(line.slice(5).trimStart());
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
