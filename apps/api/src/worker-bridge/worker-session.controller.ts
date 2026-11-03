import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
type Input=Record<string,unknown>;
@Controller('internal/worker')
export class WorkerSessionController {
 constructor(private readonly db:DatabaseService){}
 private check(auth:string|undefined,body:Input):string {
  const secret=process.env.WORKER_DISPATCH_SECRET;
  if(!secret||!auth?.startsWith('Bearer '))throw new ForbiddenException();
  const a=Buffer.from(auth.slice(7)),b=Buffer.from(secret);
  if(a.length!==b.length||!timingSafeEqual(a,b))throw new ForbiddenException();
  if(typeof body?.workerId!=='string'||!/^[a-zA-Z0-9._:-]{1,120}$/.test(body.workerId))throw new ForbiddenException();
  return body.workerId;
 }
 private sid(body:Input):string {
  if(typeof body.sessionId!=='string'||!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(body.sessionId))throw new ForbiddenException();
  return body.sessionId;
 }
 @Post('sessions/recoverable') @HttpCode(200)
 async recoverable(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  const worker=this.check(auth,body);
  const limit=Number(body.limit),stale=Number(body.connectingStaleMs),lease=Number(body.leaseMs);
  if(!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(stale)||stale<0||stale>3600000||!Number.isSafeInteger(lease)||lease<1000||lease>300000)throw new ForbiddenException();
  const result=await this.db.query(`WITH candidates AS (SELECT id FROM whatsapp_sessions WHERE deleted_at IS NULL AND status IN ('connecting','connected','reconnecting','disconnected') AND (worker_lease_expires_at IS NULL OR worker_lease_expires_at<=now()) AND (status<>'connecting' OR updated_at<=now()-($1::bigint*interval '1 millisecond')) ORDER BY updated_at ASC FOR UPDATE SKIP LOCKED LIMIT $2) UPDATE whatsapp_sessions s SET worker_id=$3,worker_lease_expires_at=now()+($4::bigint*interval '1 millisecond'),recovery_started_at=now(),recovery_reason='worker_startup',updated_at=now() FROM candidates c WHERE s.id=c.id RETURNING s.id,s.status,s.reconnect_attempts`,[stale,limit,worker,lease]);
  return {sessions:result.rows};
 }
 @Post('sessions/qr') @HttpCode(200)
 async qr(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  const worker=this.check(auth,body),id=this.sid(body),ttl=Number(body.ttlMs??60000);
  if(typeof body.qr!=='string'||body.qr.length>16000||!Number.isSafeInteger(ttl)||ttl<1000||ttl>60000)throw new ForbiddenException();
  await this.db.transaction(async client=>{
   const r=await client.query(`UPDATE whatsapp_sessions SET status='need_scan',qr_code=$3,qr_expires_at=CASE WHEN status='need_scan' THEN qr_expires_at ELSE now()+($4::bigint*interval '1 millisecond') END,updated_at=now() WHERE id=$1 AND worker_id=$2 AND deleted_at IS NULL RETURNING organization_id`,[id,worker,body.qr,ttl]);
   if(r.rowCount)await client.query(`INSERT INTO whatsapp_session_events(organization_id,session_id,event_type,payload) VALUES($1,$2,'session.qr_updated',$3::jsonb)`,[r.rows[0].organization_id,id,JSON.stringify({expiresInMs:ttl})]);
  });return {ok:true};
 }
 @Post('sessions/profile') @HttpCode(200)
 async profile(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  const worker=this.check(auth,body),id=this.sid(body),p=body.profile;
  if(!p||typeof p!=='object'||Array.isArray(p))throw new ForbiddenException();
  const data=p as Record<string,unknown>;
  const field=(key:string)=>typeof data[key]==='string'?String(data[key]).slice(0,200):null;
  await this.db.query(`UPDATE whatsapp_sessions SET whatsapp_jid=COALESCE($3,whatsapp_jid),phone_number=COALESCE($4,phone_number),display_name=COALESCE($5,display_name),profile_picture_url=COALESCE($6,profile_picture_url),profile_synced_at=now(),updated_at=now() WHERE id=$1 AND worker_id=$2 AND deleted_at IS NULL`,[id,worker,field('jid'),field('phoneNumber'),field('displayName'),field('profilePictureUrl')]);return {ok:true};
 }
 @Post('sessions/status') @HttpCode(200)
 async status(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  const worker=this.check(auth,body),id=this.sid(body);
  const allowed=['pending','need_scan','connecting','connected','disconnected','reconnecting','logged_out','expired','error'];
  if(typeof body.status!=='string'||!allowed.includes(body.status))throw new ForbiddenException();
  const d=body.details;
  if(d!==undefined&&(!d||typeof d!=='object'||Array.isArray(d)))throw new ForbiddenException();
  const details=(d??{}) as Record<string,unknown>;
  const field=(name:string,max=200)=>typeof details[name]==='string'?String(details[name]).slice(0,max):null;
  const clearQr=details.clearQr===true,reset=details.resetReconnectAttempts===true;
  const result=await this.db.query(`UPDATE whatsapp_sessions SET status=$3::varchar,phone_number=COALESCE($4,phone_number),display_name=COALESCE($5,display_name),whatsapp_jid=COALESCE($6,whatsapp_jid),profile_picture_url=COALESCE($7,profile_picture_url),qr_code=CASE WHEN $8 THEN NULL ELSE qr_code END,qr_expires_at=CASE WHEN $8 THEN NULL ELSE qr_expires_at END,connection_opened_at=CASE WHEN $3='connected' THEN now() ELSE connection_opened_at END,last_connected_at=CASE WHEN $3='connected' THEN now() ELSE last_connected_at END,last_disconnected_at=CASE WHEN $3 IN ('disconnected','logged_out','error') THEN now() ELSE last_disconnected_at END,last_connection_error=$9,reconnect_attempts=CASE WHEN $10 THEN 0 ELSE reconnect_attempts END,updated_at=now() WHERE id=$1 AND worker_id=$2 AND deleted_at IS NULL RETURNING id`,[id,worker,body.status,field('phoneNumber',40),field('displayName',160),field('jid'),field('profilePictureUrl',2048),clearQr,field('lastConnectionError',2000),reset]);
  return {ok:true,updated:result.rowCount===1};
 }
 @Post('sessions/profile-from-contact') @HttpCode(200)
 async profileFromContact(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  const worker=this.check(auth,body),id=this.sid(body);
  if(!body.contact||typeof body.contact!=='object'||Array.isArray(body.contact))throw new ForbiddenException();
  const c=body.contact as Record<string,unknown>;
  if(typeof c.id!=='string'||c.id.length>200)throw new ForbiddenException();
  const display=[c.name,c.notify,c.verifiedName].find(v=>typeof v==='string'&&v.trim().length>0);
  if(typeof display!=='string')return {ok:true};
  await this.db.query(`UPDATE whatsapp_sessions SET display_name=$4,profile_synced_at=now(),updated_at=now() WHERE id=$1 AND worker_id=$2 AND whatsapp_jid=$3 AND deleted_at IS NULL`,[id,worker,c.id,display.trim().slice(0,160)]);
  return {ok:true};
 }
 @Post('engine') @HttpCode(200)
 async engine(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  this.check(auth,body);const id=this.sid(body);
  const result=await this.db.query<{engine:string}>(`SELECT engine FROM whatsapp_sessions WHERE id=$1 AND deleted_at IS NULL`,[id]);
  return {engine:result.rows[0]?.engine??'baileys'};
 }
 @Post('sessions/reconnect-attempts') @HttpCode(200)
 async attempts(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  const worker=this.check(auth,body),id=this.sid(body);
  const result=await this.db.query<{reconnect_attempts:number}>(`SELECT reconnect_attempts FROM whatsapp_sessions WHERE id=$1 AND worker_id=$2 AND deleted_at IS NULL`,[id,worker]);
  return {attempts:result.rows[0]?.reconnect_attempts??0};
 }
 @Post('sessions/reconnect') @HttpCode(200)
 async reconnect(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  const worker=this.check(auth,body),id=this.sid(body);
  const error=typeof body.error==='string'?body.error.slice(0,2000):null;
  const result=await this.db.query<{reconnect_attempts:number}>(`UPDATE whatsapp_sessions SET reconnect_attempts=reconnect_attempts+1,last_connection_error=$3,updated_at=now() WHERE id=$1 AND worker_id=$2 AND deleted_at IS NULL RETURNING reconnect_attempts`,[id,worker,error]);
  return {attempts:result.rows[0]?.reconnect_attempts??1};
 }
 @Post('sessions/recovered') @HttpCode(200)
 async recovered(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  const worker=this.check(auth,body),id=this.sid(body);
  const reason=typeof body.reason==='string'?body.reason.slice(0,200):'recovered';
  await this.db.query(`UPDATE whatsapp_sessions SET last_recovery_at=now(),recovery_started_at=NULL,recovery_reason=$3,updated_at=now() WHERE id=$1 AND worker_id=$2`,[id,worker,reason]);return {ok:true};
 }
 @Post('sessions/recovery-failed') @HttpCode(200)
 async recoveryFailed(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  const worker=this.check(auth,body),id=this.sid(body);
  const error=typeof body.error==='string'?body.error.slice(0,2000):'Recovery failed';
  await this.db.query(`UPDATE whatsapp_sessions SET status='error',last_connection_error=$3,recovery_started_at=NULL,recovery_reason='recovery_failed',updated_at=now() WHERE id=$1 AND worker_id=$2`,[id,worker,error]);return {ok:true};
 }
 @Post('sessions/event') @HttpCode(200)
 async event(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  const worker=this.check(auth,body),id=this.sid(body);
  if(typeof body.eventType!=='string'||body.eventType.length>64)throw new ForbiddenException();
  await this.db.query(`INSERT INTO whatsapp_session_events(organization_id,session_id,event_type,payload) SELECT organization_id,id,$3,$4::jsonb FROM whatsapp_sessions WHERE id=$1 AND worker_id=$2 AND deleted_at IS NULL`,[id,worker,body.eventType,JSON.stringify(body.payload??{})]);return {ok:true};
 }
}
