/** Server-side RelayWA API client. Never expose session keys in browser code. */
export type SendMessageInput = { to: string; text: string; clientMessageId?: string };
export type AdvancedMessageBase = { to: string; clientMessageId?: string; scheduledAt?: string; priority?: number; maxAttempts?: number };
export type LocationMessageInput = AdvancedMessageBase & { latitude: number; longitude: number; name?: string; address?: string };
export type ContactMessageInput = AdvancedMessageBase & { displayName: string; vcard: string };
export type PollMessageInput = AdvancedMessageBase & { question: string; options: string[]; selectableCount: number };
export type ReplyMessageInput = AdvancedMessageBase & { text: string; quotedMessageId: string; quotedText?: string; quotedFromMe?: boolean };
export type ReactionMessageInput = AdvancedMessageBase & { emoji: string; targetMessageId: string; targetFromMe?: boolean };
export type WebhookCreateInput = { name: string; url: string; eventTypes?: string[] };
export type WebhookUpdateInput = { name?: string; url?: string; eventTypes?: string[]; enabled?: boolean };
export type RelayWAOptions = { sessionKey: string; baseUrl?: string; fetch?: typeof globalThis.fetch; timeoutMs?: number };

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
  private readonly timeoutMs: number;

  constructor(options: RelayWAOptions) {
    if (!options.sessionKey?.trim()) throw new Error('RelayWA sessionKey is required');
    this.sessionKey = options.sessionKey;
    this.baseUrl = (options.baseUrl ?? 'https://relaywa.com/api').replace(/\/$/, '');
    const url = new URL(this.baseUrl);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('RelayWA baseUrl must use HTTPS');
    }
    if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 120000)) {
      throw new Error('RelayWA timeoutMs must be an integer between 1 and 120000');
    }
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.transport = options.fetch ?? globalThis.fetch;
  }

  private async request(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await this.transport(`${this.baseUrl}${path}`, {
      method,
      signal: AbortSignal.timeout(this.timeoutMs),
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
    create: (input: Record<string, unknown>): Promise<unknown> => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Session input required');
      return this.request('POST', '/whatsapp-sessions', input);
    },
    update: (id: string, input: Record<string, unknown>): Promise<unknown> => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Session update input required');
      return this.request('PATCH', `/whatsapp-sessions/${this.segment(id)}`, input);
    },
    connect: (id: string): Promise<unknown> => this.request('POST', `/whatsapp-sessions/${this.segment(id)}/connect`),
    restart: (id: string): Promise<unknown> => this.request('POST', `/whatsapp-sessions/${this.segment(id)}/restart`),
    disconnect: (id: string): Promise<unknown> => this.request('POST', `/whatsapp-sessions/${this.segment(id)}/disconnect`),
    remove: (id: string): Promise<unknown> => this.request('DELETE', `/whatsapp-sessions/${this.segment(id)}`),

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

  private sendAction(kind: 'location' | 'contact' | 'poll' | 'reply' | 'reaction', input: Record<string, unknown>): Promise<unknown> {
    const str = (value: unknown, min: number, max: number): boolean => typeof value === 'string' && value.length >= min && value.length <= max;
    if (!str(input.to, 7, 32)) throw new Error('Recipient must be 7–32 characters');
    if (input.clientMessageId !== undefined && !str(input.clientMessageId, 0, 120)) throw new Error('Invalid clientMessageId');
    for (const field of ['priority', 'maxAttempts']) {
      const value = input[field];
      if (value !== undefined && (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 10)) throw new Error('Invalid ' + field);
    }
    if (kind === 'location' && (typeof input.latitude !== 'number' || !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 || typeof input.longitude !== 'number' || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180)) throw new Error('Invalid coordinates');
    if (kind === 'contact' && (!str(input.displayName, 1, 160) || !str(input.vcard, 10, 12000))) throw new Error('Invalid contact');
    if (kind === 'poll' && (!str(input.question, 1, 255) || !Array.isArray(input.options) || input.options.length < 2 || input.options.length > 12 || input.options.some(x => !str(x, 0, 100)) || !Number.isInteger(input.selectableCount) || (input.selectableCount as number) < 1 || (input.selectableCount as number) > 12 || (input.selectableCount as number) > input.options.length)) throw new Error('Invalid poll');
    if (kind === 'reply' && (!str(input.text, 1, 4096) || !str(input.quotedMessageId, 1, 180))) throw new Error('Invalid reply');
    if (kind === 'reaction' && (!str(input.emoji, 0, 32) || !str(input.targetMessageId, 1, 180))) throw new Error('Invalid reaction');
    return this.request('POST', '/send-' + kind, input);
  }

  readonly messages = {
    sendLocation: (input: LocationMessageInput): Promise<unknown> => this.sendAction('location', input),
    sendContact: (input: ContactMessageInput): Promise<unknown> => this.sendAction('contact', input),
    sendPoll: (input: PollMessageInput): Promise<unknown> => this.sendAction('poll', input),
    sendReply: (input: ReplyMessageInput): Promise<unknown> => this.sendAction('reply', input),
    sendReaction: (input: ReactionMessageInput): Promise<unknown> => this.sendAction('reaction', input),
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
