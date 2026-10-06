import { BadRequestException } from '@nestjs/common';

export type MediaType = 'image' | 'video' | 'audio' | 'document';

export const MEDIA_LIMITS: Record<MediaType, number> = {
  image: 16 * 1024 * 1024,
  video: 64 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 100 * 1024 * 1024,
};

const MIME_PREFIXES: Record<MediaType, readonly string[]> = {
  image: ['image/'],
  video: ['video/'],
  audio: ['audio/'],
  document: [
    'application/',
    'text/',
    'image/',
    'audio/',
    'video/',
  ],
};

export function validateMediaInput(
  type: MediaType,
  url: string,
  mimeType: string,
  sizeBytes: number,
) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Invalid media URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('Media URL must use HTTPS');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new BadRequestException('Private-network media URLs are not allowed');
  }

  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MEDIA_LIMITS[type]) {
    throw new BadRequestException(
      `Media size exceeds relayWA ${type} limit of ${MEDIA_LIMITS[type]} bytes`,
    );
  }

  const normalizedMime = mimeType.trim().toLowerCase();
  if (!MIME_PREFIXES[type].some((prefix) => normalizedMime.startsWith(prefix))) {
    throw new BadRequestException(`MIME type is not valid for ${type}`);
  }

  return {
    url: parsed.toString(),
    mimeType: normalizedMime,
    sizeBytes,
  };
}
