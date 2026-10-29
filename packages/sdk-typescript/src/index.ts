/** Server-side RelayWA API client. Never expose session keys in browser code. */
export type SendMessageInput = { to: string; text: string; clientMessageId?: string };
export type MediaKind = 'image' | 'video' | 'audio' | 'document';
export type SendMediaInput = {
  to: string;
  url: string;
  mimeType: string;
  mediaSizeBytes: number;
  fileName?: string;
  caption?: string;
  voiceNote?: boolean;
  clientMessageId?: string;
  scheduledAt?: string;
  priority?: number;
  maxAttempts?: number;
};
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
    this.sessionKey = options.sessionKey;
    this.baseUrl = (options.baseUrl ?? 'https://relaywa.com/api').replace(/\/$/, '');
    const url = new URL(this.baseUrl);
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

  private sendMedia(kind: MediaKind, input: SendMediaInput): Promise<unknown> {
    if (!input.to?.trim() || input.to.length < 7 || input.to.length > 32) throw new Error('Media recipient must be 7–32 characters');
    let url: URL;
    try { url = new URL(input.url); } catch { throw new Error('Media URL must use HTTPS'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Media URL must use HTTPS without embedded credentials');
    if (!input.mimeType?.trim()) throw new Error('Media mimeType is required');
    const limits: Record<MediaKind, number> = { image: 16 * 1024 * 1024, video: 64 * 1024 * 1024, audio: 16 * 1024 * 1024, document: 100 * 1024 * 1024 };
    if (!Number.isSafeInteger(input.mediaSizeBytes) || input.mediaSizeBytes < 1 || input.mediaSizeBytes > limits[kind]) throw new Error('Media size is invalid or exceeds the server limit');
    return this.request('POST', `/send-${kind}`, input);
  }

  readonly messages = {
    sendImage: (input: SendMediaInput): Promise<unknown> => this.sendMedia('image', input),
    sendVideo: (input: SendMediaInput): Promise<unknown> => this.sendMedia('video', input),
    sendAudio: (input: SendMediaInput): Promise<unknown> => this.sendMedia('audio', input),
    sendDocument: (input: SendMediaInput): Promise<unknown> => this.sendMedia('document', input),
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
