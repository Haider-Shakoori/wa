export function assertProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'WEBHOOK_ENCRYPTION_KEY',
    'RELAYWA_ADMIN_EMAIL',
    'RELAYWA_ADMIN_PASSWORD',
  ];

  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production settings: ${missing.join(', ')}`);
  }

  if ((process.env.JWT_SECRET ?? '').length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  if ((process.env.RELAYWA_ADMIN_PASSWORD ?? '').length < 12) {
    throw new Error('RELAYWA_ADMIN_PASSWORD must be at least 12 characters in production');
  }

  const webhookKey = Buffer.from(process.env.WEBHOOK_ENCRYPTION_KEY ?? '', 'base64');
  if (webhookKey.length !== 32) {
    throw new Error('WEBHOOK_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
}
