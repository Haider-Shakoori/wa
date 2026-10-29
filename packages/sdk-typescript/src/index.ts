/** Server-side RelayWA API client. Never expose session keys in browser code. */
export type SendMessageInput = { to: string; text: string; clientMessageId?: string };
export type WebhookCreateInput = { name: string; url: string; eventTypes?: string[] };
export type WebhookUpdateInput = { name?: string; url?: string; eventTypes?: string[]; enabled?: boolean };
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

  private async request(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: Record<string, unknown>): Promise<unknown> {
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

  private validateWebhook(input: WebhookUpdateInput): void {
    if (input.name !== undefined && (typeof input.name !== 'string' || input.name.length < 2 || input.name.length > 120)) throw new Error('Webhook name must be 2–120 characters');
    if (input.url !== undefined) {
      let url: URL;
      try { url = new URL(input.url); } catch { throw new Error('Webhook URL must use HTTPS'); }
      if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Webhook URL must use HTTPS without credentials');
    }
    if (input.eventTypes !== undefined && (!Array.isArray(input.eventTypes) || input.eventTypes.length > 32 || input.eventTypes.some(x => typeof x !== 'string' || x.length > 64))) throw new Error('Invalid webhook event types');
    if (input.enabled !== undefined && typeof input.enabled !== 'boolean') throw new Error('Webhook enabled must be boolean');
  }

  readonly webhooks = {
    create: (input: WebhookCreateInput): Promise<unknown> => {
      if (!input.name || !input.url) throw new Error('Webhook name and URL required');
      this.validateWebhook(input);
      return this.request('POST', '/webhooks', input);
    },
    update: (id: string, input: WebhookUpdateInput): Promise<unknown> => {
      this.validateWebhook(input);
      return this.request('PATCH', `/webhooks/${this.segment(id)}`, input);
    },
    remove: (id: string): Promise<unknown> => this.request('DELETE', `/webhooks/${this.segment(id)}`),
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

export { verifyWebhookSignature } from './webhook-signature.js';
export type { WebhookVerificationInput } from './webhook-signature.js';
