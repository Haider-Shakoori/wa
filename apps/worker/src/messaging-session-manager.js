export class MessagingSessionManager {
  constructor({ store, baileys, chromium }) {
    this.store = store;
    this.engines = new Map([
      ['baileys', baileys],
      ['chromium', chromium],
    ]);
  }

  async managerFor(sessionId) {
    const engine = await this.store.getSessionEngine(sessionId);
    const manager = this.engines.get(engine);
    if (!manager) throw new Error(`Unsupported messaging engine: ${engine}`);
    return manager;
  }

  async restore(sessionId, status) {
    return (await this.managerFor(sessionId)).restore(sessionId, status);
  }

  async connect(sessionId, options) {
    return (await this.managerFor(sessionId)).connect(sessionId, options);
  }

  async restart(sessionId) {
    return (await this.managerFor(sessionId)).restart(sessionId);
  }

  async logout(sessionId) {
    return (await this.managerFor(sessionId)).logout(sessionId);
  }

  async sendText(sessionId, message) {
    return (await this.managerFor(sessionId)).sendText(sessionId, message);
  }

  async sendMedia(sessionId, message, uploadedBuffer) {
    return (await this.managerFor(sessionId)).sendMedia(sessionId, message, uploadedBuffer);
  }

  async sendAction(sessionId, message) {
    return (await this.managerFor(sessionId)).sendAction(sessionId, message);
  }

  async close() {
    for (const manager of this.engines.values()) {
      if (typeof manager.close === 'function') await manager.close();
    }
  }
}
