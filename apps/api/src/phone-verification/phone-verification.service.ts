import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException, TooManyRequestsException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

type Row = {
  id: string;
  status: 'pending' | 'verified' | 'consumed';
  phone_e164: string;
  expires_at: string;
  verified_at: string | null;
};
type IncomingChange = {
  value?: {
    metadata?: { phone_number_id?: unknown };
    messages?: Array<{ id?: unknown; from?: unknown; type?: unknown; text?: { body?: unknown } }>;
  };
};
type IncomingEntry = { changes?: IncomingChange[] };

@Injectable()
export class PhoneVerificationService {
  constructor(private readonly db: DatabaseService) {}

  private senderNumber() {
    const number = process.env.RELAYWA_VERIFY_WHATSAPP_NUMBER ?? '';
    if (!/^[1-9]\d{7,14}$/.test(number)) {
      throw new ServiceUnavailableException('WhatsApp verification number not configured');
    }
    return number;
  }

  async start(org: string, phone: string) {
    const sender = this.senderNumber();
    const token = randomBytes(24).toString('base64url'); // 192 bits, 32 URL-safe characters.
    const hash = createHash('sha256').update(token).digest('hex');
    const id = randomUUID();
    const dailyLimit = Math.max(1, Math.min(100000, Number(process.env.PHONE_VERIFY_DAILY_LIMIT || 1000) || 1000));

    const result = await this.db.transaction(async (client) => {
      // Serialize per-tenant quota decisions to prevent concurrent over-issuing.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [org]);
      const counts = await client.query<{ all_count: string; phone_count: string }>(
        `SELECT count(*) AS all_count,
           count(*) FILTER (WHERE phone_e164=$2) AS phone_count
         FROM whatsapp_phone_verifications
         WHERE organization_id=$1 AND created_at >= now() - interval '24 hours'`,
        [org, phone],
      );
      const count = counts.rows[0];
      if (Number(count.all_count) >= dailyLimit) {
        throw new TooManyRequestsException('Daily phone verification allowance exceeded');
      }
      if (Number(count.phone_count) >= 5) {
        throw new TooManyRequestsException('Too many verification requests for this number');
      }
      return client.query<{ expires_at: string }>(
        `INSERT INTO whatsapp_phone_verifications
          (id,organization_id,phone_e164,token_hash,expires_at)
         VALUES ($1,$2,$3,$4,now() + interval '5 minutes')
         RETURNING expires_at`,
        [id, org, phone, hash],
      );
    });
    const message = `VERIFY ${token}`;
    return {
      id,
      status: 'pending',
      expiresAt: result.rows[0].expires_at,
      whatsappUrl: `https://wa.me/${sender}?text=${encodeURIComponent(message)}`,
      instruction: 'Open WhatsApp and press Send. Do not share the verification message.',
    };
  }

  async status(org: string, id: string) {
    if (!isUuid(id)) throw new BadRequestException('Invalid verification ID');
    const result = await this.db.query<Row>(
      `SELECT id,status,phone_e164,expires_at,verified_at
       FROM whatsapp_phone_verifications
       WHERE organization_id=$1 AND id=$2`,
      [org, id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Verification not found');
    return {
      id: row.id,
      status: row.status === 'pending' && new Date(row.expires_at).getTime() <= Date.now() ? 'expired' : row.status,
      expiresAt: row.expires_at,
      verifiedAt: row.verified_at,
    };
  }

  async consume(org: string, id: string) {
    if (!isUuid(id)) throw new BadRequestException('Invalid verification ID');
    const result = await this.db.query<Row>(
      `UPDATE whatsapp_phone_verifications
       SET status='consumed', consumed_at=now()
       WHERE organization_id=$1 AND id=$2 AND status='verified' AND expires_at>now()
       RETURNING id,phone_e164,status,expires_at,verified_at`,
      [org, id],
    );
    const row = result.rows[0];
    if (!row) throw new ConflictException('Verification is not valid, is expired, or was already consumed');
    return { verified: true, id: row.id, phone: row.phone_e164, verifiedAt: row.verified_at };
  }

  // The caller MUST first authenticate Meta's X-Hub-Signature-256 over raw request bytes.
  async receiveSignedWebhook(payload: unknown) {
    if (!payload || typeof payload !== 'object') return;
    const entry = (payload as { entry?: unknown }).entry;
    if (!Array.isArray(entry)) return;
    const numberId = process.env.RELAYWA_VERIFY_META_PHONE_NUMBER_ID;
    if (!numberId) throw new ServiceUnavailableException('Meta phone number ID not configured');

    for (const item of entry as IncomingEntry[]) {
      if (!Array.isArray(item?.changes)) continue;
      for (const change of item.changes) {
        if (change?.value?.metadata?.phone_number_id !== numberId) continue;
        const messages = change.value.messages;
        if (!Array.isArray(messages)) continue;
        for (const msg of messages) {
          if (msg?.type !== 'text' || typeof msg.from !== 'string' ||
              !/^[1-9]\d{6,14}$/.test(msg.from) ||
              typeof msg.id !== 'string' || msg.id.length > 255) continue;
          const body = msg.text?.body;
          if (typeof body !== 'string') continue;
          const match = /^VERIFY ([A-Za-z0-9_-]{32})$/.exec(body.trim());
          if (!match) continue;
          const hash = createHash('sha256').update(match[1]).digest('hex');
          // Atomic single-use match against the VERIFIED sender, not the number entered by the application.
          await this.db.query(
            `UPDATE whatsapp_phone_verifications SET
               status='verified', verified_at=now(), inbound_message_id=$3
             WHERE token_hash=$1 AND phone_e164=$2 AND status='pending'
               AND expires_at>now()`,
            [hash, `+${msg.from}`, msg.id],
          );
        }
      }
    }
  }
}

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
}
