import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { authorizeSharedWorker } from './shared-worker-authorization';
type Input=Record<string,unknown>;
@Controller('internal/worker')
export class WorkerMessagesController {
 constructor(private readonly db:DatabaseService){}
 private async auth(h:string|undefined,b:Input):Promise<string>{return authorizeSharedWorker(this.db,h,b.workerId); }
 private uuid(v:unknown):string {if(typeof v!=='string'||!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(v))throw new ForbiddenException();return v;}
 private mode(v:unknown):boolean {if(typeof v!=='boolean')throw new ForbiddenException();return v;}
 @Post('messages/claim') @HttpCode(200)
 async claim(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=await this.auth(h,b),id=this.uuid(b.messageId),live=this.mode(b.stripeLivemode);
  const r=await this.db.query(`UPDATE whatsapp_messages m SET status='claimed',worker_id=$1,claimed_at=now(),attempts=attempts+1,updated_at=now() FROM whatsapp_sessions s,organizations o,organization_subscriptions sub WHERE m.id=$2 AND m.session_id=s.id AND o.id=m.organization_id AND o.suspended_at IS NULL AND sub.organization_id=m.organization_id AND sub.status IN ('trialing','active') AND (sub.provider IS DISTINCT FROM 'stripe' OR sub.stripe_livemode=$3) AND sub.current_period_end>now() AND (sub.status<>'trialing' OR sub.trial_ends_at IS NULL OR sub.trial_ends_at>now()) AND m.direction='outbound' AND m.status='queued' AND s.deleted_at IS NULL AND s.status='connected' AND s.worker_id=$1 AND s.worker_lease_expires_at>now() RETURNING m.*`,[worker,id,live]);return {message:r.rows[0]??null};
 }
 @Post('messages/poll') @HttpCode(200)
 async poll(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=await this.auth(h,b),live=this.mode(b.stripeLivemode);
  const message=await this.db.transaction(async client=>{
   const r=await client.query(`SELECT m.id FROM whatsapp_messages m JOIN whatsapp_sessions s ON s.id=m.session_id JOIN organizations o ON o.id=m.organization_id AND o.suspended_at IS NULL JOIN organization_subscriptions sub ON sub.organization_id=m.organization_id WHERE m.direction='outbound' AND m.status='queued' AND s.deleted_at IS NULL AND s.status='connected' AND s.worker_id=$1 AND s.worker_lease_expires_at>now() AND sub.status IN ('trialing','active') AND (sub.provider IS DISTINCT FROM 'stripe' OR sub.stripe_livemode=$2) AND sub.current_period_end>now() AND (sub.status<>'trialing' OR sub.trial_ends_at IS NULL OR sub.trial_ends_at>now()) ORDER BY m.queued_at ASC FOR UPDATE OF m SKIP LOCKED LIMIT 1`,[worker,live]);
   if(!r.rows[0])return null;
   const updated=await client.query(`UPDATE whatsapp_messages SET status='claimed',worker_id=$1,claimed_at=now(),attempts=attempts+1,updated_at=now() WHERE id=$2 AND status='queued' RETURNING *`,[worker,r.rows[0].id]);return updated.rows[0]??null;
  });return {message};
 }
 @Post('messages/sent') @HttpCode(200)
 async sent(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=await this.auth(h,b),id=this.uuid(b.messageId);
  const provider=typeof b.providerMessageId==='string'?b.providerMessageId.slice(0,500):null;
  const r=await this.db.query(`UPDATE whatsapp_messages SET status='sent',provider_message_id=$3,sent_at=now(),last_error=NULL,bull_job_id=NULL,updated_at=now() WHERE id=$1 AND worker_id=$2 AND status='claimed' RETURNING id`,[id,worker,provider]);return {ok:true,updated:r.rowCount===1};
 }
 @Post('messages/failed') @HttpCode(200)
 async failed(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=await this.auth(h,b),id=this.uuid(b.messageId),error=typeof b.error==='string'?b.error.slice(0,2000):'Worker delivery failed';
  const r=await this.db.query(`UPDATE whatsapp_messages SET status='failed',last_error=$3,failed_at=now(),bull_job_id=NULL,updated_at=now() WHERE id=$1 AND worker_id=$2 AND status='claimed' RETURNING id`,[id,worker,error]);return {ok:true,updated:r.rowCount===1};
 }
 @Post('sessions/inbound') @HttpCode(200)
 async inbound(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=await this.auth(h,b),session=this.uuid(b.sessionId);
  if(!b.message||typeof b.message!=='object'||Array.isArray(b.message))throw new ForbiddenException();
  const m=b.message as Record<string,unknown>;
  if(typeof m.messageType!=='string'||typeof m.providerMessageId!=='string'||m.providerMessageId.length>500)throw new ForbiddenException();
  const saved=await this.db.transaction(async client=>{
   const r=await client.query(`INSERT INTO whatsapp_messages(id,organization_id,session_id,direction,message_type,sender_phone,sender_jid,chat_jid,text_body,status,provider_message_id,media_mime_type,media_file_name,media_size_bytes,voice_note,action_payload,raw_payload,received_at,created_at,updated_at) SELECT $3,organization_id,id,'inbound',$4,$5,$6,$7,$8,'received',$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::timestamptz,now(),now() FROM whatsapp_sessions WHERE id=$1 AND worker_id=$2 AND deleted_at IS NULL ON CONFLICT(session_id,provider_message_id) WHERE direction='inbound' AND provider_message_id IS NOT NULL DO NOTHING RETURNING id,organization_id`,[session,worker,randomUUID(),m.messageType,m.senderPhone??null,m.senderJid??null,m.chatJid??null,m.textBody??null,m.providerMessageId,m.mediaMimeType??null,m.mediaFileName??null,m.mediaSizeBytes??null,m.voiceNote??false,JSON.stringify({...((m.actionPayload&&typeof m.actionPayload==='object'&&!Array.isArray(m.actionPayload))?m.actionPayload:{}),pushName:m.pushName}),JSON.stringify(m.rawPayload??{}),m.receivedAt??new Date().toISOString()]);
   const row=r.rows[0];if(!row)return null;
   await client.query(`INSERT INTO whatsapp_session_events(organization_id,session_id,event_type,payload) VALUES($1,$2,'message.received',$3::jsonb)`,[row.organization_id,session,JSON.stringify({messageId:row.id,providerMessageId:m.providerMessageId,messageType:m.messageType,senderJid:m.senderJid,senderPhone:m.senderPhone,chatJid:m.chatJid,pushName:m.pushName,receivedAt:m.receivedAt})]);return row;
  });return {saved};
 }
}
