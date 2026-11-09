import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { authorizeEnterpriseWorker } from './enterprise-worker-authorization';

type Input = Record<string, unknown>;
function uuid(v: unknown): string {
 if(typeof v!=='string'||!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(v))throw new ForbiddenException();
 return v;
}
@Controller('internal/enterprise-worker')
export class EnterpriseWorkerEventsController {
 constructor(private readonly db: DatabaseService) {}
 private auth(h:string|undefined,b:Input){return authorizeEnterpriseWorker(this.db,h,b?.workerId);}

 @Post('sessions/qr') @HttpCode(200)
 async qr(@Headers('authorization') h:string|undefined,@Body() b:Input) {
  const w=await this.auth(h,b),id=uuid(b.sessionId),ttl=b.ttlMs??60000;
  if(typeof b.qr!=='string'||b.qr.length>16000||!Number.isSafeInteger(ttl)||Number(ttl)<1000||Number(ttl)>60000)throw new ForbiddenException();
  const updated=await this.db.transaction(async client=>{
   const r=await client.query(
    `UPDATE whatsapp_sessions SET status='need_scan',qr_code=$4,
     qr_expires_at=CASE WHEN status='need_scan' THEN qr_expires_at ELSE now()+($5::bigint*interval '1 millisecond') END,
     updated_at=now() WHERE id=$1 AND organization_id=$2 AND worker_id=$3 AND deleted_at IS NULL
     RETURNING id,organization_id`,[id,w.organizationId,w.workerId,b.qr,ttl]);
   if(!r.rowCount)return false;
   await client.query(
    `INSERT INTO whatsapp_session_events(organization_id,session_id,event_type,payload)
     VALUES($1,$2,'session.qr_updated',$3::jsonb)`,
    [w.organizationId,id,JSON.stringify({expiresInMs:ttl})]);
   return true;
  });
  return {updated};
 }

 @Post('sessions/status') @HttpCode(200)
 async status(@Headers('authorization') h:string|undefined,@Body() b:Input) {
  const w=await this.auth(h,b),id=uuid(b.sessionId);
  const allowed=['pending','need_scan','connecting','connected','disconnected','reconnecting','logged_out','expired','error'];
  if(typeof b.status!=='string'||!allowed.includes(b.status))throw new ForbiddenException();
  const d=b.details??{};
  if(!d||typeof d!=='object'||Array.isArray(d))throw new ForbiddenException();
  const details=d as Record<string,unknown>;
  const field=(name:string,max:number)=>typeof details[name]==='string'?String(details[name]).slice(0,max):null;
  const r=await this.db.query(
   `UPDATE whatsapp_sessions SET status=$4::varchar,
    phone_number=COALESCE($5,phone_number),display_name=COALESCE($6,display_name),
    whatsapp_jid=COALESCE($7,whatsapp_jid),profile_picture_url=COALESCE($8,profile_picture_url),
    qr_code=CASE WHEN $9 THEN NULL ELSE qr_code END,
    qr_expires_at=CASE WHEN $9 THEN NULL ELSE qr_expires_at END,
    connection_opened_at=CASE WHEN $4='connected' THEN now() ELSE connection_opened_at END,
    last_connected_at=CASE WHEN $4='connected' THEN now() ELSE last_connected_at END,
    last_disconnected_at=CASE WHEN $4 IN ('disconnected','logged_out','error') THEN now() ELSE last_disconnected_at END,
    last_connection_error=$10,reconnect_attempts=CASE WHEN $11 THEN 0 ELSE reconnect_attempts END,
    updated_at=now() WHERE id=$1 AND organization_id=$2 AND worker_id=$3
    AND deleted_at IS NULL RETURNING id`,
   [id,w.organizationId,w.workerId,b.status,field('phoneNumber',40),field('displayName',160),
    field('jid',200),field('profilePictureUrl',2048),details.clearQr===true,
    field('lastConnectionError',2000),details.resetReconnectAttempts===true]);
  return {updated:r.rowCount===1};
 }

 @Post('sessions/inbound') @HttpCode(200)
 async inbound(@Headers('authorization') h:string|undefined,@Body() b:Input) {
  const w=await this.auth(h,b),session=uuid(b.sessionId);
  if(!b.message||typeof b.message!=='object'||Array.isArray(b.message))throw new ForbiddenException();
  const m=b.message as Record<string,unknown>;
  if(typeof m.messageType!=='string'||m.messageType.length>24||
     typeof m.providerMessageId!=='string'||m.providerMessageId.length<1||m.providerMessageId.length>180)throw new ForbiddenException();
  const saved=await this.db.transaction(async client=>{
   const r=await client.query(
    `INSERT INTO whatsapp_messages(id,organization_id,session_id,direction,message_type,sender_phone,sender_jid,chat_jid,text_body,status,provider_message_id,media_mime_type,media_file_name,media_size_bytes,voice_note,action_payload,raw_payload,received_at,created_at,updated_at)
     SELECT $4,s.organization_id,s.id,'inbound',$5,$6,$7,$8,$9,'received',$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17::timestamptz,now(),now()
     FROM whatsapp_sessions s WHERE s.id=$1 AND s.organization_id=$2 AND s.worker_id=$3 AND s.deleted_at IS NULL
     ON CONFLICT(session_id,provider_message_id) WHERE direction='inbound' AND provider_message_id IS NOT NULL
     DO NOTHING RETURNING id,organization_id`,
    [session,w.organizationId,w.workerId,randomUUID(),m.messageType,m.senderPhone??null,m.senderJid??null,
     m.chatJid??null,m.textBody??null,m.providerMessageId,m.mediaMimeType??null,m.mediaFileName??null,
     m.mediaSizeBytes??null,m.voiceNote??false,
     JSON.stringify({...((m.actionPayload&&typeof m.actionPayload==='object'&&!Array.isArray(m.actionPayload))?m.actionPayload:{}),pushName:m.pushName}),
     JSON.stringify(m.rawPayload??{}),m.receivedAt??new Date().toISOString()]);
   const row=r.rows[0];if(!row)return null;
   await client.query(
    `INSERT INTO whatsapp_session_events(organization_id,session_id,event_type,payload)
     VALUES($1,$2,'message.received',$3::jsonb)`,
    [w.organizationId,session,JSON.stringify({messageId:row.id,providerMessageId:m.providerMessageId,
     messageType:m.messageType,senderJid:m.senderJid,senderPhone:m.senderPhone,chatJid:m.chatJid,
     pushName:m.pushName,receivedAt:m.receivedAt})]);
   return row;
  });
  return {saved};
 }
}
