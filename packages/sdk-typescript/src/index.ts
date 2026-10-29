/** Server-side RelayWA API client. Never expose session keys in browser code. */
export type SendMessageInput = { to: string; text: string; clientMessageId?: string };
export type RelayWAOptions = { sessionKey: string; baseUrl?: string; fetch?: typeof globalThis.fetch };

export class RelayWAError extends Error {
  constructor(public readonly status: number, public readonly responseBody: string) {
    super(`RelayWA API returned HTTP ${status}`);
    this.name = 'RelayWAError';
  }
}

export class RelayWA {
  private readonly sessionKey: string;
  private readonly baseUrl: string;
  private readonly transport: typeof globalThis.fetch;

  constructor(options: RelayWAOptions) {
    if (!options.sessionKey?.trim()) throw new Error('RelayWA sessionKey is required');
    if (/\r|\n/.test(options.sessionKey)) throw new Error('RelayWA sessionKey must not contain newlines');
    this.sessionKey = options.sessionKey;
    this.baseUrl = (options.baseUrl ?? 'https://relaywa.com/api').replace(/\/$/, '');
    const url = new URL(this.baseUrl);
    if (url.username || url.password || url.search || url.hash) throw new Error('RelayWA baseUrl must not include credentials, query or fragment');
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('RelayWA baseUrl must use HTTPS');
    }
    this.transport = options.fetch ?? globalThis.fetch;
  }

  private async request(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await this.transport(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.sessionKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new RelayWAError(response.status, await response.text());
    return response.json();
  }

  private segment(id: string): string {
    if (!id?.trim()) throw new Error('Resource ID is required');
    return encodeURIComponent(id);
  }

  readonly sessions = {
    list: (): Promise<unknown> => this.request('GET', '/whatsapp-sessions'),
    get: (id: string): Promise<unknown> => this.request('GET', `/whatsapp-sessions/${this.segment(id)}`),
    qrCode: (id: string): Promise<unknown> => this.request('GET', `/whatsapp-sessions/${this.segment(id)}/qrcode`),
    messages: (id: string): Promise<unknown> => this.request('GET', `/whatsapp-sessions/${this.segment(id)}/messages`),
    contacts: (id: string): Promise<unknown> => this.request('GET', `/whatsapp-sessions/${this.segment(id)}/contacts`),
    chats: (id: string): Promise<unknown> => this.request('GET', `/whatsapp-sessions/${this.segment(id)}/chats`),
    groups: (id: string): Promise<unknown> => this.request('GET', `/whatsapp-sessions/${this.segment(id)}/groups`),
  };

  readonly webhooks = {
    list: (): Promise<unknown> => this.request('GET', '/webhooks'),
    deliveries: (endpointId: string): Promise<unknown> => this.request('GET', `/webhooks/${this.segment(endpointId)}/deliveries`),
  };

  readonly messages = {
    send: async (input: SendMessageInput): Promise<unknown> => {
      if (!input.to?.trim() || !input.text?.trim()) throw new Error('to and text are required');
      const response = await this.transport(`${this.baseUrl}/send-message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.sessionKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new RelayWAError(response.status, await response.text());
      return response.json();
    },
  };
}
