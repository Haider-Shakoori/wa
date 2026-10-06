import { BadRequestException } from '@nestjs/common';

export function normalizeWhatsAppRecipient(input: string) {
  let phone = input.trim().replace(/[\s()-]/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('+')) phone = phone.slice(1);

  if (!/^\d{7,15}$/.test(phone)) {
    throw new BadRequestException('Recipient must be an international phone number');
  }

  return {
    phone,
    jid: `${phone}@s.whatsapp.net`,
  };
}
