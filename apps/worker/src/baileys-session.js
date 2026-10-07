import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { syncSessionProfile } from './profile-sync.js';
import { fetchMedia } from './media-fetch.js';
import { normalizeInboundMessage } from './inbound-message.js';

const logger = pino({ level: process.env.WA_LOG_LEVEL ?? 'silent' });
const RECONNECT_DELAYS_MS = [1500, 3000, 7000, 15000, 30000, 60000];

export class BaileysSessionManager {
  constructor({ store, authRoot }) {
    this.store = store;
    this.authRoot = authRoot;
    this.sockets = new Map();
    this.heartbeats = new Map();
    this.reconnectTimers = new Map();
    this.qrTimers = new Map();
    this.profileControllers = new Map();
  }

  authPath(sessionId) {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('Invalid session id');
    return join(this.authRoot, sessionId);
  }

  async restore(sessionId) {
    return this.connect(sessionId, { recovery: true });
  }

  async connect(sessionId, { recovery = false } = {}) {
    if (this.sockets.has(sessionId)) {
      if (recovery || this.sockets.get(sessionId).user) return;
      await this.disconnectRuntime(sessionId);
    }
    this.clearReconnect(sessionId);

    const authPath = this.authPath(sessionId);
    await mkdir(authPath, { recursive: true });

    let state;
    let saveCreds;
    try {
      ({ state, saveCreds } = await useMultiFileAuthState(authPath));
    } catch (error) {
      await this.quarantineAuth(sessionId, error);
      return;
    }

    await this.store.setStatus(sessionId, recovery ? 'reconnecting' : 'connecting');

    const socket = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('relayWA'),
      logger,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
    });

    this.sockets.set(sessionId, socket);
    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;

      for (const item of messages) {
        try {
          const normalized = normalizeInboundMessage(item);
          if (normalized) await this.store.saveInboundMessage(sessionId, normalized);
        } catch (error) {
          logger.error({ err: error, sessionId }, 'incoming message persistence failed');
        }
      }
    });

    socket.ev.on('contacts.upsert', async (contacts) => {
      for (const contact of contacts) {
        await this.store.upsertContact(sessionId, contact);
        await this.store.updateProfileFromContact(sessionId, contact);
      }
    });

    socket.ev.on('chats.upsert', async (chats) => {
      for (const chat of chats) {
        await this.store.upsertChat(sessionId, chat);
      }
    });

    socket.ev.on('groups.upsert', async (groups) => {
      for (const group of groups) {
        await this.store.upsertGroup(sessionId, group);
      }
    });

    socket.ev.on('connection.update', async (update) => {
      if (this.sockets.get(sessionId) !== socket) return;
      try {
        if (update.qr) { await this.store.setQr(sessionId, update.qr); this.startQrExpiry(sessionId); }

        if (update.connection === 'open') {
          clearTimeout(this.qrTimers.get(sessionId));
          this.qrTimers.delete(sessionId);
          const profileController = new AbortController();
          this.cancelProfileSync(sessionId);
          this.profileControllers.set(sessionId, profileController);

          const identity = await syncSessionProfile({
            sessionId,
            socket,
            store: this.store,
            signal: profileController.signal,
          });

          if (this.sockets.get(sessionId) !== socket) return;
          await this.store.setStatus(sessionId, 'connected', {
            ...identity,
            clearQr: true,
            resetReconnectAttempts: true,
          });
          await this.store.event(sessionId, 'session.connected', identity);
          this.startHeartbeat(sessionId);
        }

        if (update.connection === 'close') {
          this.stopHeartbeat(sessionId);
          this.cancelProfileSync(sessionId);
          this.sockets.delete(sessionId);

          const error = update.lastDisconnect?.error ?? null;
          const code = error?.output?.statusCode ?? error?.statusCode ?? null;
          const loggedOut = code === DisconnectReason.loggedOut;

          if (loggedOut) {
            await this.store.setStatus(sessionId, 'logged_out', {
              clearQr: true,
              lastConnectionError: error?.message ?? null,
            });
            await this.store.event(sessionId, 'session.logged_out', { code });
            return;
          }

          const reconnectAttempts = await this.store.incrementReconnect(sessionId, error);
          await this.store.setStatus(sessionId, 'reconnecting', {
            clearQr: true,
            lastConnectionError: error?.message ?? null,
          });
          await this.store.event(sessionId, 'session.reconnecting', { code, reconnectAttempts });
          this.scheduleReconnect(sessionId, reconnectAttempts);
        }
      } catch (error) {
        logger.error({ err: error, sessionId }, 'connection update handler failed');
      }
    });
  }

  async sendText(sessionId, message) {
    const socket = this.sockets.get(sessionId);
    if (!socket) throw new Error('Session socket is not active');

    const result = await socket.sendMessage(message.recipient_jid, {
      text: message.text_body,
    });
    const providerMessageId = result?.key?.id ?? null;
    await this.store.markMessageSent(message.id, providerMessageId);
    await this.store.event(sessionId, 'message.sent', {
      messageId: message.id,
      providerMessageId,
      recipient: message.recipient_phone,
    });
    return { providerMessageId };
  }

  async sendMedia(sessionId, message) {
    const socket = this.sockets.get(sessionId);
    if (!socket) throw new Error('Session socket is not active');

    const buffer = await fetchMedia(message);
    let payload;

    if (message.message_type === 'image') {
      payload = {
        image: buffer,
        mimetype: message.media_mime_type,
        caption: message.media_caption || undefined,
      };
    } else if (message.message_type === 'video') {
      payload = {
        video: buffer,
        mimetype: message.media_mime_type,
        caption: message.media_caption || undefined,
      };
    } else if (message.message_type === 'audio') {
      payload = {
        audio: buffer,
        mimetype: message.media_mime_type,
        ptt: Boolean(message.voice_note),
      };
    } else if (message.message_type === 'document') {
      payload = {
        document: buffer,
        mimetype: message.media_mime_type,
        fileName: message.media_file_name || 'document',
        caption: message.media_caption || undefined,
      };
    } else {
      throw new Error(`Unsupported media type: ${message.message_type}`);
    }

    const result = await socket.sendMessage(message.recipient_jid, payload);
    const providerMessageId = result?.key?.id ?? null;
    await this.store.markMessageSent(message.id, providerMessageId);
    await this.store.event(sessionId, 'message.sent', {
      messageId: message.id,
      providerMessageId,
      recipient: message.recipient_phone,
      messageType: message.message_type,
    });
    return { providerMessageId };
  }

  async sendAction(sessionId, message) {
    const socket = this.sockets.get(sessionId);
    if (!socket) throw new Error('Session socket is not active');

    const action = message.action_payload ?? {};
    let payload;
    let options;

    if (message.message_type === 'reply') {
      const quotedMessage = action.quotedText
        ? { conversation: action.quotedText }
        : { conversation: '' };
      payload = {
        text: action.text,
        contextInfo: {
          stanzaId: action.quotedMessageId,
          participant: message.recipient_jid,
          quotedMessage,
        },
      };
    } else if (message.message_type === 'reaction') {
      payload = {
        react: {
          text: action.emoji,
          key: {
            remoteJid: message.recipient_jid,
            fromMe: Boolean(action.targetFromMe),
            id: action.targetMessageId,
          },
        },
      };
    } else if (message.message_type === 'location') {
      payload = {
        location: {
          degreesLatitude: Number(action.latitude),
          degreesLongitude: Number(action.longitude),
          name: action.name || undefined,
          address: action.address || undefined,
        },
      };
    } else if (message.message_type === 'contact') {
      payload = {
        contacts: {
          displayName: action.displayName,
          contacts: [{ vcard: action.vcard }],
        },
      };
    } else if (message.message_type === 'poll') {
      payload = {
        poll: {
          name: action.question,
          values: action.options,
          selectableCount: Number(action.selectableCount),
        },
      };
    } else {
      throw new Error(`Unsupported message action: ${message.message_type}`);
    }

    const result = await socket.sendMessage(message.recipient_jid, payload, options);
    const providerMessageId = result?.key?.id ?? null;
    await this.store.markMessageSent(message.id, providerMessageId);
    await this.store.event(sessionId, 'message.sent', {
      messageId: message.id,
      providerMessageId,
      recipient: message.recipient_phone,
      messageType: message.message_type,
    });
    return { providerMessageId };
  }

  async quarantineAuth(sessionId, error) {
    const authPath = this.authPath(sessionId);
    const quarantinePath = `${authPath}.corrupt-${Date.now()}`;
    try {
      await rename(authPath, quarantinePath);
    } catch {
      await rm(authPath, { recursive: true, force: true });
    }
    await mkdir(authPath, { recursive: true });
    await this.store.setStatus(sessionId, 'need_scan', {
      clearQr: true,
      lastConnectionError: `auth_corrupt: ${String(error?.message ?? error).slice(0, 500)}`,
    });
    await this.store.event(sessionId, 'session.auth_corrupt', {});
  }

  async restart(sessionId) {
    await this.disconnectRuntime(sessionId);
    await this.store.setStatus(sessionId, 'reconnecting', { clearQr: true });
    await this.connect(sessionId, { recovery: true });
  }

  async logout(sessionId) {
    const socket = this.sockets.get(sessionId);
    this.stopHeartbeat(sessionId);
    this.clearReconnect(sessionId);
    this.cancelProfileSync(sessionId);
    this.sockets.delete(sessionId);
    try {
      if (socket) await socket.logout();
    } finally {
      if (socket) socket.end(undefined);
      await this.disconnectRuntime(sessionId);
      await rm(this.authPath(sessionId), { recursive: true, force: true });
      await this.store.setStatus(sessionId, 'logged_out', { clearQr: true });
      await this.store.event(sessionId, 'session.logged_out', {});
    }
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
    this.cancelProfileSync(sessionId);
    const socket = this.sockets.get(sessionId);
    this.sockets.delete(sessionId);
    if (socket) socket.end(undefined);
  }

  scheduleReconnect(sessionId, reconnectAttempts = 1) {
    this.clearReconnect(sessionId);
    const index = Math.min(Math.max(reconnectAttempts - 1, 0), RECONNECT_DELAYS_MS.length - 1);
    const delay = RECONNECT_DELAYS_MS[index];
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(sessionId);
      this.connect(sessionId, { recovery: true }).catch((error) =>
        logger.error({ err: error, sessionId }, 'automatic reconnect failed'),
      );
    }, delay);
    timer.unref();
    this.reconnectTimers.set(sessionId, timer);
  }

  clearReconnect(sessionId) {
    const timer = this.reconnectTimers.get(sessionId);
    if (timer) clearTimeout(timer);
    this.reconnectTimers.delete(sessionId);
  }

  cancelProfileSync(sessionId) {
    const controller = this.profileControllers.get(sessionId);
    controller?.abort();
    this.profileControllers.delete(sessionId);
  }

  startHeartbeat(sessionId) {
    this.stopHeartbeat(sessionId);
    const timer = setInterval(() => {
      this.store.heartbeat(sessionId).catch((error) =>
        logger.error({ err: error, sessionId }, 'session heartbeat failed'),
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
}
