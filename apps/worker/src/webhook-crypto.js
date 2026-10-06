import { createDecipheriv, createHmac } from 'node:crypto';

function key() {
  const raw = process.env.WEBHOOK_ENCRYPTION_KEY;
  if (!raw) throw new Error('WEBHOOK_ENCRYPTION_KEY is required');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32) throw new Error('WEBHOOK_ENCRYPTION_KEY must decode to 32 bytes');
  return decoded;
}

export function decryptWebhookSecret(value) {
  const [ivRaw, tagRaw, ciphertextRaw] = value.split('.');
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error('Invalid encrypted webhook secret');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function signWebhook(secret, timestamp, body) {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}
