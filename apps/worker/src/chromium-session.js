import { resolve, relative, isAbsolute } from 'node:path';
import WhatsAppWeb from 'whatsapp-web.js';
import pino from 'pino';
import { mkdir, rm } from 'node:fs/promises';
import { fetchMedia } from './media-fetch.js';

const { Client, LocalAuth, Location, MessageMedia, Poll } = WhatsAppWeb;
const logger = pino({ level: process.env.WA_LOG_LEVEL ?? 'silent' });
const RECONNECT_DELAYS_MS = [3000, 7000, 15000, 30000, 60000];

function chromiumChatId(jid) {
  if (!jid) return jid;
  if (jid.endsWith('@s.whatsapp.net')) return jid.replace('@s.whatsapp.net', '@c.us');
  return jid;
}

function providerMessageId(message) {
  return message?.id?._serialized ?? message?.id?.id ?? null;
}

function inboundMessageType(type, hasMedia) {
  if (hasMedia) {
    if (type === 'image') return 'image';
    if (type === 'video') return 'video';
    if (type === 'audio' || type === 'ptt') return 'audio';
    if (type === 'document') return 'document';
  }
  if (type === 'location') return 'location';
  if (type === 'vcard' || type === 'multi_vcard') return 'contact';
  if (type === 'poll_creation') return 'poll';
  return 'text';
}

function normalizeInbound(message) {
  if (!message || message.fromMe || !message.from) return null;
  const senderJid = message.author || message.from;
  const senderPhone = String(senderJid).split('@')[0].split(':')[0] || null;
  return {
    messageType: inboundMessageType(message.type, message.hasMedia),
    senderPhone,
    senderJid,
    chatJid: message.from,
    textBody: message.body || null,
    providerMessageId: providerMessageId(message),
    mediaMimeType: null,
    mediaFileName: null,
    mediaSizeBytes: null,
    voiceNote: message.type === 'ptt',
    actionPayload: message.location ? {
      latitude: message.location.latitude,
      longitude: message.location.longitude,
    } : {},
    pushName: null,
    rawPayload: {
      engine: 'chromium',
      type: message.type,
      from: message.from,
      author: message.author || null,
      hasMedia: Boolean(message.hasMedia),
    },
    receivedAt: new Date(Number(message.timestamp || Date.now() / 1000) * 1000).toISOString(),
  };
}

export class ChromiumSessionManager {
  constructor({ store, authRoot }) {
    this.store = store;
    this.authRoot = authRoot;
    this.clients = new Map();
    this.heartbeats = new Map();
    this.reconnectTimers = new Map();
    this.qrTimers = new Map();
    this.maxSessions = Number(process.env.CHROMIUM_MAX_SESSIONS_PER_WORKER ?? 6);
  }

  async restore(sessionId) {
    return this.connect(sessionId, { recovery: true });
  }

  async connect(sessionId, { recovery = false } = {}) {
    if (this.clients.has(sessionId)) {
      if (recovery || this.clients.get(sessionId).info) return;
      await this.disconnectRuntime(sessionId);
    }
    if (this.maxSessions > 0 && this.clients.size >= this.maxSessions) {
      throw new Error(`Chromium session capacity reached for this worker (${this.maxSessions})`);
    }

    this.clearReconnect(sessionId);
    await mkdir(this.authRoot, { recursive: true });
    await this.store.setStatus(sessionId, recovery ? 'reconnecting' : 'connecting');

    const executablePath = String(process.env.CHROMIUM_EXECUTABLE_PATH ?? '').trim();
    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: sessionId,
        dataPath: this.authRoot,
      }),
      puppeteer: {
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    });

    this.clients.set(sessionId, client);

    client.on('qr', async (qr) => {
      if (this.clients.get(sessionId) !== client) return;
      await this.store.setQr(sessionId, qr);
      this.startQrExpiry(sessionId);
    });

    client.on('ready', async () => {
      clearTimeout(this.qrTimers.get(sessionId));
      this.qrTimers.delete(sessionId);
      if (this.clients.get(sessionId) !== client) return;
      try {
        const jid = client.info?.wid?._serialized ?? null;
        const phoneNumber = jid ? jid.split('@')[0].split(':')[0] : null;
        const displayName = client.info?.pushname ?? null;
        let profilePictureUrl = null;
        if (jid) {
          try { profilePictureUrl = await client.getProfilePicUrl(jid); } catch {}
        }

        await this.store.setStatus(sessionId, 'connected', {
          jid,
          phoneNumber,
          displayName,
          profilePictureUrl,
          clearQr: true,
          resetReconnectAttempts: true,
        });
        await this.store.event(sessionId, 'session.connected', {
          jid,
          phoneNumber,
          displayName,
          engine: 'chromium',
        });
        this.startHeartbeat(sessionId);
      } catch (error) {
        logger.error({ err: error, sessionId }, 'chromium ready handler failed');
      }
    });

    client.on('message', async (message) => {
      try {
        const normalized = normalizeInbound(message);
        if (normalized) await this.store.saveInboundMessage(sessionId, normalized);
      } catch (error) {
        logger.error({ err: error, sessionId }, 'chromium inbound persistence failed');
      }
    });

    client.on('auth_failure', async (message) => {
      if (this.clients.get(sessionId) !== client) return;
      await this.store.setStatus(sessionId, 'error', {
        clearQr: true,
        lastConnectionError: `chromium_auth_failure: ${String(message).slice(0, 500)}`,
      });
      await this.store.event(sessionId, 'session.auth_failure', { engine: 'chromium' });
    });

    client.on('disconnected', async (reason) => {
      if (this.clients.get(sessionId) !== client) return;
      this.stopHeartbeat(sessionId);
      this.clients.delete(sessionId);
      try { await client.destroy(); } catch {}

      const loggedOut = String(reason || '').toUpperCase().includes('LOGOUT');
      if (loggedOut) {
        await this.store.setStatus(sessionId, 'logged_out', {
          clearQr: true,
          lastConnectionError: String(reason || 'logged out'),
        });
        await this.store.event(sessionId, 'session.logged_out', { engine: 'chromium', reason });
        return;
      }

      const reconnectAttempts = await this.store.incrementReconnect(
        sessionId,
        new Error(String(reason || 'Chromium disconnected')),
      );
      await this.store.setStatus(sessionId, 'reconnecting', {
        clearQr: true,
        lastConnectionError: String(reason || 'Chromium disconnected'),
      });
      await this.store.event(sessionId, 'session.reconnecting', {
        engine: 'chromium',
        reason,
        reconnectAttempts,
      });
      this.scheduleReconnect(sessionId, reconnectAttempts);
    });

    try {
      await client.initialize();
    } catch (error) {
      if (this.clients.get(sessionId) === client) {
        this.clients.delete(sessionId);
        try { await client.destroy(); } catch {}
      }
      await this.store.setStatus(sessionId, 'error', {
        clearQr: true,
        lastConnectionError: String(error?.message ?? error).slice(0, 1000),
      });
      throw error;
    }
  }

  clientFor(sessionId) {
    const client = this.clients.get(sessionId);
    if (!client) throw new Error('Chromium session is not active');
    return client;
  }

  async sendText(sessionId, message) {
    const result = await this.clientFor(sessionId).sendMessage(
      chromiumChatId(message.recipient_jid),
      message.text_body,
    );
    return this.markSent(sessionId, message, providerMessageId(result));
  }

  async sendMedia(sessionId, message) {
    const client = this.clientFor(sessionId);
    const buffer = await fetchMedia(message);
    let media;
    try {
    media = new MessageMedia(
      message.media_mime_type || 'application/octet-stream',
      buffer.toString('base64'),
      message.media_file_name || undefined,
      buffer.length,
    );
    const result = await client.sendMessage(chromiumChatId(message.recipient_jid), media, {
      caption: message.media_caption || undefined,
      sendAudioAsVoice: message.message_type === 'audio' && Boolean(message.voice_note),
      sendMediaAsDocument: message.message_type === 'document',
    });
    return await this.markSent(sessionId, message, providerMessageId(result), { mediaSizeBytes: buffer.length, mediaRetained: false });
    } finally {
      buffer.fill(0);
      if (media) media.data = '';
    }
  }

  async sendAction(sessionId, message) {
    const client = this.clientFor(sessionId);
    const chatId = chromiumChatId(message.recipient_jid);
    const action = message.action_payload ?? {};
    let result = null;

    if (message.message_type === 'reply') {
      result = await client.sendMessage(chatId, action.text, {
        quotedMessageId: action.quotedMessageId,
      });
    } else if (message.message_type === 'reaction') {
      await client.sendReaction(action.targetMessageId, action.emoji);
    } else if (message.message_type === 'location') {
      result = await client.sendMessage(
        chatId,
        new Location(Number(action.latitude), Number(action.longitude), {
          name: action.name || undefined,
          address: action.address || undefined,
        }),
      );
    } else if (message.message_type === 'contact') {
      result = await client.sendMessage(chatId, action.vcard, { parseVCards: true });
    } else if (message.message_type === 'poll') {
      result = await client.sendMessage(
        chatId,
        new Poll(action.question, action.options, {
          allowMultipleAnswers: Number(action.selectableCount ?? 1) > 1,
        }),
      );
    } else {
      throw new Error(`Unsupported Chromium message action: ${message.message_type}`);
    }

    return this.markSent(sessionId, message, providerMessageId(result));
  }

  async markSent(sessionId, message, id, transfer = {}) {
    await this.store.markMessageSent(message.id, id);
    await this.store.event(sessionId, 'message.sent', {
      ...transfer,
      messageId: message.id,
      providerMessageId: id,
      recipient: message.recipient_phone,
      messageType: message.message_type,
      engine: 'chromium',
    });
    return { providerMessageId: id };
  }

  async restart(sessionId) {
    await this.disconnectRuntime(sessionId);
    await this.store.setStatus(sessionId, 'reconnecting', { clearQr: true });
    await this.connect(sessionId, { recovery: true });
  }

  async logout(sessionId) {
    const client = this.clients.get(sessionId);
    this.stopHeartbeat(sessionId);
    this.clearReconnect(sessionId);
    this.clients.delete(sessionId);
    if (client) {
      try { await client.logout(); } catch (error) {
        logger.warn({ err: error, sessionId }, 'chromium logout failed; clearing runtime');
      }
    }
    if (client) { try { await client.destroy(); } catch {} }
    await this.disconnectRuntime(sessionId);
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('Invalid session id');
    const root = resolve(this.authRoot);
    const target = resolve(root, 'session-' + sessionId);
    const inside = relative(root, target);
    if (!inside || inside.startsWith('..') || isAbsolute(inside)) throw new Error('Invalid auth path');
    await rm(target, { recursive: true, force: true });
    await this.store.setStatus(sessionId, 'logged_out', { clearQr: true });
    await this.store.event(sessionId, 'session.logged_out', { engine: 'chromium' });
  }

  startQrExpiry(sessionId) {
    if (this.qrTimers.has(sessionId)) return;
    const timer = setTimeout(async () => {
      try {
        await this.disconnectRuntime(sessionId);
        await this.store.setStatus(sessionId, 'logged_out', {clearQr:false});
        await this.store.event(sessionId, 'session.qr_expired', {});
      } catch (error) { logger.error({err:error,sessionId}, 'QR expiry failed'); }
    }, 60000);
    timer.unref();
    this.qrTimers.set(sessionId,timer);
  }

  async disconnectRuntime(sessionId) {
    clearTimeout(this.qrTimers.get(sessionId));
    this.qrTimers.delete(sessionId);
    this.stopHeartbeat(sessionId);
    this.clearReconnect(sessionId);
    const client = this.clients.get(sessionId);
    this.clients.delete(sessionId);
    if (client) {
      try { await client.destroy(); } catch {}
    }
  }

  scheduleReconnect(sessionId, reconnectAttempts = 1) {
    this.clearReconnect(sessionId);
    const index = Math.min(Math.max(reconnectAttempts - 1, 0), RECONNECT_DELAYS_MS.length - 1);
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(sessionId);
      this.connect(sessionId, { recovery: true }).catch((error) =>
        logger.error({ err: error, sessionId }, 'chromium automatic reconnect failed'),
      );
    }, RECONNECT_DELAYS_MS[index]);
    timer.unref();
    this.reconnectTimers.set(sessionId, timer);
  }

  clearReconnect(sessionId) {
    const timer = this.reconnectTimers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.reconnectTimers.delete(sessionId);
  }

  startHeartbeat(sessionId) {
    this.stopHeartbeat(sessionId);
    const timer = setInterval(() => {
      this.store.heartbeat(sessionId).catch((error) =>
        logger.error({ err: error, sessionId }, 'chromium session heartbeat failed'),
      );
    }, 15000);
    timer.unref();
    this.heartbeats.set(sessionId, timer);
  }

  stopHeartbeat(sessionId) {
    const timer = this.heartbeats.get(sessionId);
    if (timer) clearInterval(timer);
    this.heartbeats.delete(sessionId);
  }

  async close() {
    for (const sessionId of [...this.clients.keys()]) {
      await this.disconnectRuntime(sessionId);
    }
  }
}
