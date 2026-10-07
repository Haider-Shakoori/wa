import { isIP } from 'node:net';

const MEDIA_LIMITS = {
  image: 16 * 1024 * 1024,
  video: 64 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

export async function fetchMedia(message) {
  const limit = MEDIA_LIMITS[message.message_type];
  if (!limit) throw new Error('Unsupported media type');

  const url = new URL(message.media_url);
  if (url.protocol !== 'https:') throw new Error('Media URL must use HTTPS');
  assertPublicHostname(url.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.MEDIA_FETCH_TIMEOUT_MS ?? 20000));
  timeout.unref();

  const chunks = [];
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      headers: { 'user-agent': 'relayWA-media-fetch/1.0' },
    });
    if (!response.ok) throw new Error(`Media download failed with HTTP ${response.status}`);

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > limit) throw new Error('Media exceeds allowed size');
    const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (contentType && contentType !== 'application/octet-stream' && contentType !== message.media_mime_type?.toLowerCase()) throw new Error('Downloaded media MIME type does not match the request');
    if (!response.body) throw new Error('Media response has no body');

    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.byteLength;
      if (total > limit) throw new Error('Media exceeds allowed size while downloading');
      chunks.push(Buffer.from(chunk));
    }
    if (total === 0) throw new Error('Media file is empty');

    const declaredSize = Number(message.media_size_bytes);
    if (!Number.isSafeInteger(declaredSize) || declaredSize !== total) throw new Error('Downloaded media size does not match mediaSizeBytes');
    return Buffer.concat(chunks, total);
  } finally {
    clearTimeout(timeout);
    controller.abort();
    for (const chunk of chunks) chunk.fill(0);
  }
}

function assertPublicHostname(hostname) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('Private-network media URL is not allowed');
  }

  if (isIP(host)) {
    if (
      host === '127.0.0.1' ||
      host === '::1' ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      throw new Error('Private-network media URL is not allowed');
    }
  }
}
