export function normalizeInboundMessage(message) {
  const key = message?.key ?? {};
  if (!key.id || key.fromMe) return null;

  const content = unwrapMessage(message.message);
  const chatJid = key.remoteJid ?? null;
  const senderJid = key.participant ?? chatJid;
  const senderPhone = phoneFromJid(senderJid);
  const pushName = message.pushName?.trim() || null;
  const timestamp = normalizeTimestamp(message.messageTimestamp);

  if (!content) {
    return base('unknown', key.id, chatJid, senderJid, senderPhone, pushName, timestamp, {});
  }

  if (content.conversation !== undefined || content.extendedTextMessage) {
    const text = content.conversation ?? content.extendedTextMessage?.text ?? '';
    return {
      ...base('text', key.id, chatJid, senderJid, senderPhone, pushName, timestamp, content),
      textBody: text || null,
    };
  }

  const media = [
    ['image', content.imageMessage],
    ['video', content.videoMessage],
    ['audio', content.audioMessage],
    ['document', content.documentMessage],
  ].find(([, value]) => Boolean(value));

  if (media) {
    const [messageType, value] = media;
    return {
      ...base(messageType, key.id, chatJid, senderJid, senderPhone, pushName, timestamp, content),
      textBody: value.caption ?? null,
      mediaMimeType: value.mimetype ?? null,
      mediaFileName: value.fileName ?? null,
      mediaSizeBytes: numeric(value.fileLength),
      voiceNote: Boolean(value.ptt),
      actionPayload: {
        caption: value.caption ?? null,
        seconds: numeric(value.seconds),
        width: numeric(value.width),
        height: numeric(value.height),
      },
    };
  }

  if (content.locationMessage) {
    const value = content.locationMessage;
    return {
      ...base('location', key.id, chatJid, senderJid, senderPhone, pushName, timestamp, content),
      actionPayload: {
        latitude: value.degreesLatitude ?? null,
        longitude: value.degreesLongitude ?? null,
        name: value.name ?? null,
        address: value.address ?? null,
      },
    };
  }

  if (content.contactMessage || content.contactsArrayMessage) {
    const value = content.contactMessage ?? content.contactsArrayMessage;
    return {
      ...base('contact', key.id, chatJid, senderJid, senderPhone, pushName, timestamp, content),
      actionPayload: {
        displayName: value.displayName ?? null,
        vcard: value.vcard ?? null,
        contacts: value.contacts ?? null,
      },
    };
  }

  if (content.reactionMessage) {
    const value = content.reactionMessage;
    return {
      ...base('reaction', key.id, chatJid, senderJid, senderPhone, pushName, timestamp, content),
      actionPayload: {
        emoji: value.text ?? '',
        targetMessageId: value.key?.id ?? null,
        targetFromMe: Boolean(value.key?.fromMe),
      },
    };
  }

  if (content.pollCreationMessage || content.pollCreationMessageV3) {
    const value = content.pollCreationMessage ?? content.pollCreationMessageV3;
    return {
      ...base('poll', key.id, chatJid, senderJid, senderPhone, pushName, timestamp, content),
      actionPayload: {
        question: value.name ?? null,
        options: (value.options ?? []).map((option) => option.optionName).filter(Boolean),
        selectableCount: value.selectableOptionsCount ?? null,
      },
    };
  }

  return base('unknown', key.id, chatJid, senderJid, senderPhone, pushName, timestamp, content);
}

function base(messageType, providerMessageId, chatJid, senderJid, senderPhone, pushName, receivedAt, rawPayload) {
  return {
    messageType,
    providerMessageId,
    chatJid,
    senderJid,
    senderPhone,
    pushName,
    receivedAt,
    textBody: null,
    mediaMimeType: null,
    mediaFileName: null,
    mediaSizeBytes: null,
    voiceNote: false,
    actionPayload: {},
    rawPayload: sanitize(rawPayload),
  };
}

function unwrapMessage(message) {
  let current = message;
  for (let i = 0; i < 4 && current; i += 1) {
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message;
      continue;
    }
    if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message;
      continue;
    }
    if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message;
      continue;
    }
    break;
  }
  return current ?? null;
}

function phoneFromJid(jid) {
  if (!jid || jid.endsWith('@g.us')) return null;
  return jid.split('@')[0].split(':')[0] || null;
}

function numeric(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return value;
  if (typeof value?.toNumber === 'function') return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeTimestamp(value) {
  const seconds = numeric(value);
  return seconds ? new Date(seconds * 1000).toISOString() : new Date().toISOString();
}

function sanitize(value) {
  return JSON.parse(JSON.stringify(value ?? {}, (_, item) => {
    if (Buffer.isBuffer(item)) return undefined;
    if (typeof item === 'bigint') return item.toString();
    return item;
  }));
}
