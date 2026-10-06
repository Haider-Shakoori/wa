import { jidNormalizedUser } from '@whiskeysockets/baileys';

const PROFILE_RETRY_DELAYS_MS = [0, 1000, 3000, 7000];

export function normalizeIdentity(user) {
  const rawJid = user?.id ?? null;
  const jid = rawJid ? jidNormalizedUser(rawJid) : null;
  const phoneNumber = jid ? jid.split('@')[0] : null;
  const displayName = user?.name?.trim() || null;
  return { jid, phoneNumber, displayName };
}

export async function syncSessionProfile({ sessionId, socket, store, signal }) {
  let lastIdentity = normalizeIdentity(socket.user);

  for (const delay of PROFILE_RETRY_DELAYS_MS) {
    if (signal?.aborted) break;
    if (delay > 0) await sleep(delay, signal);

    const identity = normalizeIdentity(socket.user);
    lastIdentity = {
      jid: identity.jid ?? lastIdentity.jid,
      phoneNumber: identity.phoneNumber ?? lastIdentity.phoneNumber,
      displayName: identity.displayName ?? lastIdentity.displayName,
    };

    let profilePictureUrl = null;
    if (lastIdentity.jid) {
      try {
        profilePictureUrl = await socket.profilePictureUrl(lastIdentity.jid, 'image');
      } catch {
        profilePictureUrl = null;
      }
    }

    await store.syncProfile(sessionId, {
      ...lastIdentity,
      profilePictureUrl,
    });

    if (lastIdentity.phoneNumber && (lastIdentity.displayName || profilePictureUrl)) {
      break;
    }
  }

  return lastIdentity;
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    timer.unref();
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}
