import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { syncSessionProfile } from './profile-sync.js';

const logger = pino({ level: process.env.WA_LOG_LEVEL ?? 'silent' });
const RECONNECT_DELAYS_MS = [1500, 3000, 7000, 15000, 30000, 60000];

export class BaileysSessionManager {
  constructor({ store, authRoot }) {
    this.store = store;
    this.authRoot = authRoot;
    this.sockets = new Map();
    this.heartbeats = new Map();
    this.reconnectTimers = new Map();
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
    if (this.sockets.has(sessionId)) return;
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

    socket.ev.on('contacts.upsert', async (contacts) => {
      for (const contact of contacts) {
        await this.store.updateProfileFromContact(sessionId, contact);
      }
    });

    socket.ev.on('connection.update', async (update) => {
      try {
        if (update.qr) await this.store.setQr(sessionId, update.qr);

        if (update.connection === 'open') {
          const profileController = new AbortController();
          this.cancelProfileSync(sessionId);
          this.profileControllers.set(sessionId, profileController);

          const identity = await syncSessionProfile({
            sessionId,
            socket,
            store: this.store,
            signal: profileController.signal,
          });

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
    try {
      if (socket) await socket.logout();
    } finally {
      await this.disconnectRuntime(sessionId);
      await rm(this.authPath(sessionId), { recursive: true, force: true });
      await this.store.setStatus(sessionId, 'logged_out', { clearQr: true });
      await this.store.event(sessionId, 'session.logged_out', {});
    }
  }

  async disconnectRuntime(sessionId) {
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
