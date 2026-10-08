import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function encodeBase32(bytes: Buffer) {
  let bits = 0, value = 0, output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { output += ALPHABET[(value >>> (bits -= 5)) & 31]; }
  }
  if (bits) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(value: string) {
  let bits = 0, accumulator = 0;
  const result: number[] = [];
  for (const character of value.toUpperCase().replace(/=+$/g, '')) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid authenticator secret');
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) { result.push((accumulator >>> (bits -= 8)) & 255); }
  }
  return Buffer.from(result);
}

function totp(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = ((digest[offset] & 127) << 24) |
    ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) |
    (digest[offset + 3] & 255);
  return String(number % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret: string, code: string, at = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(at / 30_000);
  for (let skew = -1; skew <= 1; skew++) {
    const generated = Buffer.from(totp(secret, counter + skew));
    if (timingSafeEqual(Buffer.from(code), generated)) return true;
  }
  return false;
}

function encryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'development-only-change-me') {
    throw new Error('A production JWT_SECRET is required to store authenticator secrets');
  }
  return createHash('sha256').update('relaywa-mfa-v1:').update(secret).digest();
}

export function sealMfaSecret(secret: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  const payload = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), payload]).toString('base64url');
}

export function openMfaSecret(value: string) {
  const packed = Buffer.from(value, 'base64url');
  if (packed.length < 29) throw new Error('Invalid encrypted authenticator data');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
}

export function createMfaSecret() { return encodeBase32(randomBytes(20)); }
export function createRecoveryCodes() {
  return Array.from({ length: 8 }, () => randomBytes(12).toString('hex').toUpperCase());
}
export function recoveryHash(code: string) {
  return createHash('sha256').update('relaywa-mfa-recovery:').update(code.replace(/[\s-]/g, '').toUpperCase()).digest('hex');
}
export function challengeHash(token: string) {
  return createHash('sha256').update('relaywa-mfa-challenge:').update(token).digest('hex');
}
