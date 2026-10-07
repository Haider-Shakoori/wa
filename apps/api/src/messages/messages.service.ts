import { BadRequestException, ServiceUnavailableException, BadGatewayException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { normalizeWhatsAppRecipient } from './recipient';
import { validateMediaInput, type MediaType } from './media-policy';
import { SendMediaMessageDto, SendTextMessageDto } from './messages.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
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
  constructor(
    private readonly db: DatabaseService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async sendText(
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

    await this.subscriptions.assertCanSendMessage(organizationId);

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
    await this.subscriptions.recordOutboundMessage(organizationId);
    return this.dispatchNow(organizationId, sessionId, result.rows[0]);
  }

  async sendMedia(
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

    await this.subscriptions.assertCanSendMessage(organizationId);

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
    await this.subscriptions.recordOutboundMessage(organizationId);
    return this.dispatchNow(organizationId, sessionId, result.rows[0]);
  }

  async sendAction(
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
    await this.subscriptions.recordOutboundMessage(organizationId);
    return this.dispatchNow(organizationId, sessionId, result.rows[0]);
  }

  private async dispatchNow(organizationId: string, sessionId: string, message: MessageRow) {
    const owner=await this.db.query<{worker_id:string}>('SELECT worker_id FROM whatsapp_sessions WHERE id=$1 AND organization_id=$2',[sessionId,organizationId]);
    const secret=process.env.WORKER_DISPATCH_SECRET||process.env.JWT_SECRET;
    try {
      const routes=JSON.parse(process.env.WORKER_DISPATCH_URLS||'{}') as Record<string,string>;
      const base=routes[owner.rows[0]?.worker_id]||process.env.WORKER_DISPATCH_URL||'http://127.0.0.1:3002';
      if(!secret)throw new Error('Worker dispatch secret is not configured');
      const response=await fetch(base.replace(/\/$/,'')+'/dispatch/'+message.id,{method:'POST',headers:{authorization:'Bearer '+secret},signal:AbortSignal.timeout(120000)});
      if(!response.ok){const body=await response.json().catch(()=>({}));throw new BadGatewayException({message:body.message||'Worker send failed',messageId:message.id});}
      return await this.get(organizationId,sessionId,message.id);
    }catch(error){
      // A transport timeout can have an unknown outcome. Do not retry or mark an in-flight send failed.
      await this.db.query("UPDATE whatsapp_messages SET status='failed',last_error=$2,failed_at=now(),updated_at=now() WHERE id=$1 AND status='queued'",[message.id,String(error instanceof Error?error.message:error).slice(0,2000)]);
      if(error instanceof BadGatewayException)throw error;
      throw new ServiceUnavailableException({message:'Worker response unavailable. Check message status before retrying.',messageId:message.id});
    }
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
  if(input.scheduledAt||input.priority!==undefined||input.maxAttempts!==undefined)throw new BadRequestException('Scheduling, priorities and retries must be handled by your application.');
  if(sessionStatus!=='connected')throw new ConflictException('WhatsApp session is not connected');
  return {status:'queued',scheduledAt:null,nextAttemptAt:new Date().toISOString(),priority:5,maxAttempts:1};
}
