import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { normalizeWhatsAppRecipient } from './recipient';
import { validateMediaInput, type MediaType } from './media-policy';
import { SendMediaMessageDto, SendTextMessageDto } from './messages.dto';
import {
  SendContactDto,
  SendLocationDto,
  SendPollDto,
  SendReactionDto,
  SendReplyDto,
} from './action.dto';

type SessionRow = { id: string; status: string };
type DispatchInput = {
  scheduledAt?: string;
  priority?: number;
  maxAttempts?: number;
};
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
  scheduled_at?: string | null;
  priority?: number;
  max_attempts?: number;
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
    const session = await this.getSession(organizationId, sessionId);
    const dispatch = resolveDispatch(session.status, input);
    const recipient = normalizeWhatsAppRecipient(input.to);

    const existing = await this.findIdempotent(
      organizationId,
      sessionId,
      input.clientMessageId,
    );
    if (existing) return existing;

    const result = await this.db.query<MessageRow>(
      `INSERT INTO whatsapp_messages
        (id, organization_id, session_id, created_by_user_id, client_message_id,
         recipient_phone, recipient_jid, text_body, status, scheduled_at,
         next_attempt_at, priority, max_attempts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        randomUUID(),
        organizationId,
        sessionId,
        userId,
        input.clientMessageId?.trim() || null,
        recipient.phone,
        recipient.jid,
        input.text,
        dispatch.status,
        dispatch.scheduledAt,
        dispatch.nextAttemptAt,
        dispatch.priority,
        dispatch.maxAttempts,
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
    const session = await this.getSession(organizationId, sessionId);
    const dispatch = resolveDispatch(session.status, input);
    const recipient = normalizeWhatsAppRecipient(input.to);
    const media = validateMediaInput(type, input.url, input.mimeType, input.mediaSizeBytes);

    if (type !== 'audio' && input.voiceNote) {
      throw new ConflictException('Voice-note mode is only valid for audio messages');
    }

    const existing = await this.findIdempotent(
      organizationId,
      sessionId,
      input.clientMessageId,
    );
    if (existing) return existing;

    const result = await this.db.query<MessageRow>(
      `INSERT INTO whatsapp_messages
        (id, organization_id, session_id, created_by_user_id, client_message_id,
         message_type, recipient_phone, recipient_jid, media_url,
         media_mime_type, media_file_name, media_size_bytes, media_caption,
         voice_note, status, scheduled_at, next_attempt_at, priority, max_attempts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
        dispatch.status,
        dispatch.scheduledAt,
        dispatch.nextAttemptAt,
        dispatch.priority,
        dispatch.maxAttempts,
      ],
    );
    return result.rows[0];
  }

  async queueAction(
    organizationId: string,
    userId: string,
    sessionId: string,
    type: 'reply' | 'reaction' | 'location' | 'contact' | 'poll',
    input: SendReplyDto | SendReactionDto | SendLocationDto | SendContactDto | SendPollDto,
  ) {
    const session = await this.getSession(organizationId, sessionId);
    const dispatch = resolveDispatch(session.status, input);
    const recipient = normalizeWhatsAppRecipient(input.to);
    const clientMessageId = input.clientMessageId?.trim() || null;

    const existing = await this.findIdempotent(
      organizationId,
      sessionId,
      clientMessageId,
    );
    if (existing) return existing;

    let payload: Record<string, unknown>;
    if (type === 'reply') {
      const value = input as SendReplyDto;
      payload = {
        text: value.text,
        quotedMessageId: value.quotedMessageId,
        quotedText: value.quotedText ?? null,
        quotedFromMe: Boolean(value.quotedFromMe),
      };
    } else if (type === 'reaction') {
      const value = input as SendReactionDto;
      payload = {
        emoji: value.emoji,
        targetMessageId: value.targetMessageId,
        targetFromMe: Boolean(value.targetFromMe),
      };
    } else if (type === 'location') {
      const value = input as SendLocationDto;
      payload = {
        latitude: value.latitude,
        longitude: value.longitude,
        name: value.name ?? null,
        address: value.address ?? null,
      };
    } else if (type === 'contact') {
      const value = input as SendContactDto;
      payload = {
        displayName: value.displayName,
        vcard: value.vcard,
      };
    } else {
      const value = input as SendPollDto;
      if (value.selectableCount > value.options.length) {
        throw new ConflictException('Poll selectableCount cannot exceed option count');
      }
      payload = {
        question: value.question,
        options: value.options.map((option) => option.trim()),
        selectableCount: value.selectableCount,
      };
    }

    const result = await this.db.query<MessageRow>(
      `INSERT INTO whatsapp_messages
        (id, organization_id, session_id, created_by_user_id, client_message_id,
         message_type, recipient_phone, recipient_jid, action_payload, status,
         scheduled_at, next_attempt_at, priority, max_attempts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        randomUUID(),
        organizationId,
        sessionId,
        userId,
        clientMessageId,
        type,
        recipient.phone,
        recipient.jid,
        JSON.stringify(payload),
        dispatch.status,
        dispatch.scheduledAt,
        dispatch.nextAttemptAt,
        dispatch.priority,
        dispatch.maxAttempts,
      ],
    );
    return result.rows[0];
  }

  async list(organizationId: string, sessionId: string) {
    await this.getSession(organizationId, sessionId);
    const result = await this.db.query<MessageRow>(
      `SELECT *
       FROM whatsapp_messages
       WHERE session_id = $1 AND organization_id = $2
       ORDER BY created_at DESC
       LIMIT 100`,
      [sessionId, organizationId],
    );
    return result.rows;
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

  private async getSession(organizationId: string, sessionId: string) {
    const result = await this.db.query<SessionRow>(
      `SELECT id, status
       FROM whatsapp_sessions
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [sessionId, organizationId],
    );
    if (!result.rows[0]) throw new NotFoundException('Session not found');
    return result.rows[0];
  }

  private async findIdempotent(
    organizationId: string,
    sessionId: string,
    clientMessageId?: string | null,
  ) {
    if (!clientMessageId) return null;
    const result = await this.db.query<MessageRow>(
      `SELECT *
       FROM whatsapp_messages
       WHERE organization_id = $1 AND session_id = $2 AND client_message_id = $3
       LIMIT 1`,
      [organizationId, sessionId, clientMessageId],
    );
    return result.rows[0] ?? null;
  }
}

function resolveDispatch(sessionStatus: string, input: DispatchInput) {
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const future = Boolean(scheduledAt && scheduledAt.getTime() > Date.now() + 1000);

  if (!future && sessionStatus !== 'connected') {
    throw new ConflictException('WhatsApp session is not connected');
  }

  const when = future ? scheduledAt!.toISOString() : new Date().toISOString();
  return {
    status: future ? 'scheduled' : 'queued',
    scheduledAt: future ? when : null,
    nextAttemptAt: when,
    priority: input.priority ?? 5,
    maxAttempts: input.maxAttempts ?? 5,
  };
}
