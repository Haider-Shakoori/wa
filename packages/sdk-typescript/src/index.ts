/** Server-side RelayWA API client. Never expose session keys in browser code. */
export type SendMessageInput = { to: string; text: string };
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
