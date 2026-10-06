import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const logger = pino({ level: process.env.WA_LOG_LEVEL ?? 'warn' });

export class BaileysSessionManager {
  constructor({ store, authRoot }) {
    this.store = store;
    this.authRoot = authRoot;
    this.sockets = new Map();
    this.heartbeats = new Map();
  }

  authPath(sessionId) {
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('Invalid session id');
    return join(this.authRoot, sessionId);
  }

  async connect(sessionId) {
    if (this.sockets.has(sessionId)) return;
    const authPath = this.authPath(sessionId);
    await mkdir(authPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    await this.store.setStatus(sessionId, 'connecting');

    const socket = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu('BusinessOS WA'),
      logger,
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    this.sockets.set(sessionId, socket);
    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
      try {
        if (update.qr) {
          await this.store.setQr(sessionId, update.qr);
        }

        if (update.connection === 'open') {
          const jid = socket.user?.id ?? null;
          const phoneNumber = jid ? jid.split(':')[0].split('@')[0] : null;
          const displayName = socket.user?.name ?? null;
          await this.store.setStatus(sessionId, 'connected', {
            phoneNumber,
            displayName,
            clearQr: true,
          });
          await this.store.event(sessionId, 'session.connected', { phoneNumber, displayName });
          this.startHeartbeat(sessionId);
        }

        if (update.connection === 'close') {
          this.stopHeartbeat(sessionId);
          this.sockets.delete(sessionId);
          const code =
            update.lastDisconnect?.error?.output?.statusCode ??
            update.lastDisconnect?.error?.statusCode ??
            null;
          const loggedOut = code === DisconnectReason.loggedOut;

          await this.store.setStatus(
            sessionId,
            loggedOut ? 'logged_out' : 'disconnected',
            { clearQr: true },
          );
          await this.store.event(
            sessionId,
            loggedOut ? 'session.logged_out' : 'session.disconnected',
            { code },
          );
        }
      } catch (error) {
        logger.error({ err: error, sessionId }, 'connection update handler failed');
      }
    });
  }

  async restart(sessionId) {
    await this.disconnectRuntime(sessionId);
    await this.store.setStatus(sessionId, 'reconnecting', { clearQr: true });
    await this.connect(sessionId);
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
    const socket = this.sockets.get(sessionId);
    this.sockets.delete(sessionId);
    if (socket) socket.end(undefined);
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
