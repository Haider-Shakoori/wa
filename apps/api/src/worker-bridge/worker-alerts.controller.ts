import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
type Input=Record<string,unknown>;
@Controller('internal/worker')
export class WorkerAlertsController {
 constructor(private readonly db:DatabaseService){}
 private auth(h:string|undefined,b:Input){const secret=process.env.WORKER_DISPATCH_SECRET;if(!secret||!h?.startsWith('Bearer '))throw new ForbiddenException();const a=Buffer.from(h.slice(7)),s=Buffer.from(secret);if(a.length!==s.length||!timingSafeEqual(a,s)||typeof b.workerId!=='string'||!/^[a-zA-Z0-9._:-]{1,120}$/.test(b.workerId))throw new ForbiddenException();return b.workerId;}
 private uuid(v:unknown){if(typeof v!=='string'||!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(v))throw new ForbiddenException();return v;}
 @Post('alerts/admins') @HttpCode(200)
 async admins(@Headers('authorization') h:string|undefined,@Body() b:Input){
  this.auth(h,b);
  const r=await this.db.query(`SELECT email FROM users WHERE is_platform_admin=true AND disabled_at IS NULL ORDER BY created_at ASC`);
  return {emails:r.rows.map(row=>String(row.email??'').trim()).filter(Boolean)};
 }
 @Post('alerts/claim') @HttpCode(200)
 async claim(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=this.auth(h,b);
  const alert=await this.db.transaction(async client=>{
   const r=await client.query(`SELECT * FROM system_alerts WHERE status='queued' AND next_attempt_at<=now() ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`);
   const item=r.rows[0];if(!item)return null;
   await client.query(`UPDATE system_alerts SET status='sending',worker_id=$1,claimed_at=now(),attempts=attempts+1,updated_at=now() WHERE id=$2`,[worker,item.id]);
   return {...item,attempts:Number(item.attempts)+1};
  });return {alert};
 }
 @Post('alerts/sent') @HttpCode(200)
 async sent(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=this.auth(h,b),id=this.uuid(b.alertId);
  const r=await this.db.query(`UPDATE system_alerts SET status='sent',sent_at=now(),last_error=NULL,updated_at=now() WHERE id=$1 AND worker_id=$2 AND status='sending' RETURNING id`,[id,worker]);
  return {ok:true,updated:r.rowCount===1};
 }
 @Post('alerts/reschedule') @HttpCode(200)
 async reschedule(@Headers('authorization') h:string|undefined,@Body() b:Input){
  const worker=this.auth(h,b);
  if(!b.alert||typeof b.alert!=='object'||Array.isArray(b.alert))throw new ForbiddenException();
  const alert=b.alert as Record<string,unknown>,id=this.uuid(alert.id),attempts=Number(alert.attempts);
  const max=Number(process.env.ALERT_EMAIL_MAX_ATTEMPTS??6);
  if(!Number.isSafeInteger(attempts)||attempts<1||attempts>10000||!Number.isSafeInteger(max)||max<1)throw new ForbiddenException();
  const delays=[60,300,900,3600,21600,86400],exhausted=attempts>=max;
  const delay=delays[Math.min(attempts-1,delays.length-1)];
  const error=typeof b.error==='string'?b.error:typeof (b.error as Record<string,unknown>|null)?.message==='string'?String((b.error as Record<string,unknown>).message):'Alert delivery failed';
  const r=await this.db.query(`UPDATE system_alerts SET status=$3,next_attempt_at=CASE WHEN $3='queued' THEN now()+($4::int*interval '1 second') ELSE next_attempt_at END,last_error=$5,worker_id=CASE WHEN $3='queued' THEN NULL ELSE worker_id END,claimed_at=CASE WHEN $3='queued' THEN NULL ELSE claimed_at END,updated_at=now() WHERE id=$1 AND worker_id=$2 AND status='sending' AND attempts=$6 RETURNING id`,[id,worker,exhausted?'failed':'queued',delay,error.slice(0,2000),attempts]);
  return {ok:true,updated:r.rowCount===1};
 }
 @Post('alerts/queue') @HttpCode(200)
 async queue(@Headers('authorization') h:string|undefined,@Body() b:Input){
  this.auth(h,b);
  const required=['eventType','dedupeKey','subject','summary'];
  if(required.some(k=>typeof b[k]!=='string'||!b[k]))throw new ForbiddenException();
  const cooldown=Number(b.cooldownSeconds??process.env.ALERT_DEDUPE_SECONDS??900);
  if(!Number.isSafeInteger(cooldown)||cooldown<0||cooldown>2592000)throw new ForbiddenException();
  const r=await this.db.query(`INSERT INTO system_alerts(id,event_type,severity,dedupe_key,organization_id,session_id,resource_type,resource_id,subject,summary,details) SELECT gen_random_uuid(),$1,$2,$3,$4::uuid,$5::uuid,$6,$7,$8,$9,$10::jsonb WHERE NOT EXISTS(SELECT 1 FROM system_alerts WHERE dedupe_key=$3 AND created_at>=now()-($11::int*interval '1 second')) RETURNING id`,[b.eventType,b.severity??'warning',b.dedupeKey,b.organizationId??null,b.sessionId??null,b.resourceType??null,b.resourceId??null,b.subject,b.summary,JSON.stringify(b.details??{}),cooldown]);
  return {id:r.rows[0]?.id??null};
 }
 @Post('alerts/session/queue') @HttpCode(200)
 async queueSession(@Headers('authorization') h:string|undefined,@Body() b:Input){
  this.auth(h,b);
  const id=this.uuid(b.sessionId);
  if(!b.input||typeof b.input!=='object'||Array.isArray(b.input))throw new ForbiddenException();
  const r=await this.db.query('SELECT s.organization_id,s.name AS session_name,s.phone_number,s.engine,s.status,o.name AS organization_name FROM whatsapp_sessions s JOIN organizations o ON o.id=s.organization_id WHERE s.id=$1 AND s.deleted_at IS NULL LIMIT 1',[id]);
  const row=r.rows[0];if(!row)return {id:null};
  const input=b.input as Input;
  const details=input.details&&typeof input.details==='object'&&!Array.isArray(input.details)?input.details as object:{};
  return this.queue(h,{...input,workerId:b.workerId,dedupeKey:input.dedupeKey??`session:${id}:${input.eventType}`,organizationId:row.organization_id,sessionId:id,resourceType:'whatsapp_session',resourceId:id,details:{organizationName:row.organization_name,sessionName:row.session_name,phoneNumber:row.phone_number,engine:row.engine,sessionStatus:row.status,...details}});
 }
 @Post('health-scan') @HttpCode(200)
 async healthScan(@Headers('authorization') h:string|undefined,@Body() b:Input){
  this.auth(h,b);
  await this.db.query(`UPDATE system_alerts a SET resolved_at=now(),updated_at=now() FROM whatsapp_sessions s WHERE a.event_type='worker.session_lease_expired' AND a.resolved_at IS NULL AND a.session_id=s.id AND s.deleted_at IS NULL AND s.worker_id IS NOT NULL AND s.worker_lease_expires_at>now()`);
  const stale=await this.db.query(`SELECT s.id,s.organization_id,s.name,s.status,s.worker_id,s.worker_lease_expires_at,o.name AS organization_name FROM whatsapp_sessions s JOIN organizations o ON o.id=s.organization_id AND o.suspended_at IS NULL WHERE s.deleted_at IS NULL AND s.worker_id IS NOT NULL AND s.worker_lease_expires_at IS NOT NULL AND s.worker_lease_expires_at<now()-interval '1 minute' AND s.status IN ('connected','connecting','reconnecting') ORDER BY s.worker_lease_expires_at ASC LIMIT 25`);
  const stalled=await this.db.query(`SELECT organization_id,count(*)::int AS stalled FROM (SELECT m.organization_id FROM whatsapp_messages m JOIN organizations o ON o.id=m.organization_id AND o.suspended_at IS NULL WHERE m.direction='outbound' AND m.status='queued' AND m.queued_at<now()-interval '10 minutes' ORDER BY m.queued_at ASC LIMIT 500) pending GROUP BY organization_id HAVING count(*)>=10 LIMIT 20`);
  for(const s of stale.rows){await this.queue(h,{workerId:b.workerId,eventType:'worker.session_lease_expired',severity:'critical',dedupeKey:'lease:'+s.id+':expired',organizationId:s.organization_id,sessionId:s.id,resourceType:'whatsapp_session',resourceId:s.id,subject:'WhatsApp worker lease expired',summary:'A WhatsApp session appears to have lost its active worker ownership and needs review.',details:{organizationName:s.organization_name,sessionName:s.name,workerId:s.worker_id,sessionStatus:s.status,leaseExpiresAt:s.worker_lease_expires_at},cooldownSeconds:900});}
  for(const s of stalled.rows){await this.queue(h,{workerId:b.workerId,eventType:'messaging.queue_stalled',severity:'warning',dedupeKey:'org:'+s.organization_id+':stalled-queue',organizationId:s.organization_id,resourceType:'organization',resourceId:s.organization_id,subject:'Outgoing message queue appears stalled',summary:'At least ten outbound messages have remained queued for over ten minutes. Investigate dispatch and session connectivity.',details:{stalledMessages:s.stalled},cooldownSeconds:1800});}
  return {staleLeases:stale.rowCount??0,stalledOrganizations:stalled.rowCount??0};
 }
 private async claimBillingRow(worker:string){
  return this.db.transaction(async client=>{
   const r=await client.query(`SELECT * FROM billing_notification_outbox WHERE status='pending' AND next_attempt_at<=now() ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`);
   const item=r.rows[0];if(!item)return null;
   await client.query(`UPDATE billing_notification_outbox SET attempts=attempts+1,next_attempt_at=now()+interval '2 minutes',claim_worker_id=$2,claim_expires_at=now()+interval '2 minutes' WHERE id=$1`,[item.id,worker]);
   const recipient=await client.query(`SELECT u.email FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.status='active' AND m.role IN ('owner','admin') AND u.disabled_at IS NULL ORDER BY CASE WHEN m.role='owner' THEN 0 ELSE 1 END LIMIT 1`,[item.organization_id]);
   return {...item,attempts:Number(item.attempts)+1,recipientEmail:recipient.rows[0]?.email??null};
  });
 }
 @Post('billing/claim') @HttpCode(200)
 async billingClaim(@Headers('authorization') h:string|undefined,@Body() b:Input){this.auth(h,b);return {notification:await this.claimBillingRow(String(b.workerId))};}
 @Post('billing/sent') @HttpCode(200)
 async billingSent(@Headers('authorization') h:string|undefined,@Body() b:Input){
  this.auth(h,b);const id=this.uuid(b.id),attempts=Number(b.attempts);
  if(!Number.isSafeInteger(attempts)||attempts<1||attempts>10000)throw new ForbiddenException();
  const r=await this.db.query(`UPDATE billing_notification_outbox SET status='sent',sent_at=now(),last_error=NULL,claim_worker_id=NULL,claim_expires_at=NULL WHERE id=$1 AND status='pending' AND claim_worker_id=$2 AND claim_expires_at>now() AND attempts=$3 RETURNING id`,[id,b.workerId,attempts]);
  return {ok:true,updated:r.rowCount===1};
 }
 @Post('billing/failed') @HttpCode(200)
 async billingFailed(@Headers('authorization') h:string|undefined,@Body() b:Input){
  this.auth(h,b);const id=this.uuid(b.id),attempts=Number(b.attempts);
  if(!Number.isSafeInteger(attempts)||attempts<1||attempts>10000)throw new ForbiddenException();
  const max=Number(process.env.BILLING_EMAIL_MAX_ATTEMPTS??6);
  if(!Number.isSafeInteger(max)||max<1)throw new ForbiddenException();
  const exhausted=attempts>=max,delay=[60,300,900,3600,21600,86400][Math.min(attempts-1,5)];
  const r=await this.db.query(`UPDATE billing_notification_outbox SET status=$2::varchar,next_attempt_at=CASE WHEN $2::varchar='pending' THEN now()+($3::int*interval '1 second') ELSE next_attempt_at END,last_error=$4,claim_worker_id=NULL,claim_expires_at=NULL WHERE id=$1 AND status='pending' AND attempts=$5 AND claim_worker_id=$6 AND claim_expires_at>now() RETURNING id`,[id,exhausted?'failed':'pending',delay,String(b.error??'Billing notification delivery failed').slice(0,300),attempts,b.workerId]);
  return {ok:true,updated:r.rowCount===1};
 }
}
