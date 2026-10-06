import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { normalizeWhatsAppRecipient } from './recipient';
import { validateMediaInput, type MediaType } from './media-policy';
import { SendMediaMessageDto, SendTextMessageDto } from './messages.dto';

type SessionRow = { id: string; status: string };
type MessageRow = {
  id: string;
  session_id: string;
  recipient_phone: string;
  recipient_jid: string;
  text_body: string;
  status: string;
  provider_message_id: string | null;
  attempts: number;
  last_error: string | null;
  queued_at: string;
  sent_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class MessagesService {
  constructor(private readonly db: DatabaseService) {}

  async queueText(
    organizationId: string,
    userId: string,
    sessionId: string,
    input: SendTextMessageDto,
  ) {
    const sessionResult = await this.db.query<SessionRow>(
      `SELECT id, status
       FROM whatsapp_sessions
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId, organizationId],
    );
    const session = sessionResult.rows[0];
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'connected') {
      throw new ConflictException('WhatsApp session is not connected');
    }

    const recipient = normalizeWhatsAppRecipient(input.to);
    const id = randomUUID();

    if (input.clientMessageId) {
      const existing = await this.db.query<MessageRow>(
        `SELECT *
         FROM whatsapp_messages
         WHERE organization_id = $1 AND session_id = $2 AND client_message_id = $3
         LIMIT 1`,
        [organizationId, sessionId, input.clientMessageId],
      );
      if (existing.rows[0]) return existing.rows[0];
    }

    const result = await this.db.query<MessageRow>(
      `INSERT INTO whatsapp_messages
        (id, organization_id, session_id, created_by_user_id, client_message_id,
         recipient_phone, recipient_jid, text_body, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued')
       RETURNING *`,
      [
        id,
        organizationId,
        sessionId,
        userId,
        input.clientMessageId?.trim() || null,
        recipient.phone,
        recipient.jid,
        input.text,
      ],
    );
    return result.rows[0];
  }

  async queueMedia(
    organizationId: string,
    userId: string,
    sessionId: string,
    type: MediaType,
    input: SendMediaMessageDto,
  ) {
    const sessionResult = await this.db.query<SessionRow>(
      `SELECT id, status
       FROM whatsapp_sessions
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId, organizationId],
    );
    const session = sessionResult.rows[0];
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'connected') {
      throw new ConflictException('WhatsApp session is not connected');
    }

    const recipient = normalizeWhatsAppRecipient(input.to);
    const media = validateMediaInput(type, input.url, input.mimeType, input.mediaSizeBytes);

    if (type !== 'audio' && input.voiceNote) {
      throw new ConflictException('Voice-note mode is only valid for audio messages');
    }

    if (input.clientMessageId) {
      const existing = await this.db.query<MessageRow>(
        `SELECT *
         FROM whatsapp_messages
         WHERE organization_id = $1 AND session_id = $2 AND client_message_id = $3
         LIMIT 1`,
        [organizationId, sessionId, input.clientMessageId],
      );
      if (existing.rows[0]) return existing.rows[0];
    }

    const result = await this.db.query<MessageRow>(
      `INSERT INTO whatsapp_messages
        (id, organization_id, session_id, created_by_user_id, client_message_id,
         message_type, recipient_phone, recipient_jid, media_url,
         media_mime_type, media_file_name, media_size_bytes, media_caption,
         voice_note, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'queued')
       RETURNING *`,
      [
        randomUUID(),
        organizationId,
        sessionId,
        userId,
        input.clientMessageId?.trim() || null,
        type,
        recipient.phone,
        recipient.jid,
        media.url,
        media.mimeType,
        input.fileName?.trim() || null,
        media.sizeBytes,
        input.caption?.trim() || null,
        Boolean(input.voiceNote),
      ],
    );
    return result.rows[0];
  }

  async get(organizationId: string, sessionId: string, messageId: string) {
    const result = await this.db.query<MessageRow>(
      `SELECT *
       FROM whatsapp_messages
       WHERE id = $1 AND session_id = $2 AND organization_id = $3
       LIMIT 1`,
      [messageId, sessionId, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException('Message not found');
    return result.rows[0];
  }
}
