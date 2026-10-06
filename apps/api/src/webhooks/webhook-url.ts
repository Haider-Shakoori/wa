import { BadRequestException } from '@nestjs/common';

export function validateWebhookUrl(input: string) {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new BadRequestException('Invalid webhook URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('Webhook URL must use HTTPS');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '::1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new BadRequestException('Private-network webhook URLs are not allowed');
  }

  return parsed.toString();
}
