import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
type Input = { workerId?: unknown; sessionId?: unknown; leaseMs?: unknown; commandId?: unknown; error?: unknown };
@Controller('internal/worker')
export class WorkerBridgeController {
 constructor(private readonly db: DatabaseService) {}
 private authenticate(auth: string | undefined) {
  const secret=process.env.WORKER_DISPATCH_SECRET;
  if(!secret||!auth?.startsWith('Bearer ')) throw new ForbiddenException();
  const a=Buffer.from(auth.slice(7)),b=Buffer.from(secret);
  if(a.length!==b.length||!timingSafeEqual(a,b)) throw new ForbiddenException();
 }
 private id(body:Input):string {
  if(typeof body?.workerId!=='string'||!/^[a-zA-Z0-9._:-]{1,120}$/.test(body.workerId))throw new ForbiddenException();
  return body.workerId;
 }
 private uuid(value:unknown):string {
  if(typeof value!=='string'||!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(value))throw new ForbiddenException();
  return value;
 }
 private lease(value:unknown):number {
  const ms=Number(value);
  if(!Number.isSafeInteger(ms)||ms<1000||ms>300000)throw new ForbiddenException();
  return ms;
 }
 @Post('heartbeat') @HttpCode(200)
 async heartbeat(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  this.authenticate(auth);const workerId=this.id(body);
  await this.db.query(`INSERT INTO relaywa_worker_heartbeats(worker_id,first_seen_at,last_seen_at) VALUES ($1,now(),now()) ON CONFLICT(worker_id) DO UPDATE SET last_seen_at=now()`,[workerId]);
  return {ok:true};
 }
 @Post('sessions/heartbeat') @HttpCode(200)
 async sessionHeartbeat(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  this.authenticate(auth);const workerId=this.id(body),sessionId=this.uuid(body.sessionId),ms=this.lease(body.leaseMs);
  const result=await this.db.query(`UPDATE whatsapp_sessions SET worker_lease_expires_at=now()+($1::bigint * interval '1 millisecond'),last_heartbeat_at=now(),updated_at=now() WHERE id=$2 AND worker_id=$3 AND deleted_at IS NULL RETURNING id`,[ms,sessionId,workerId]);
  return {ok:true,updated:result.rowCount===1};
 }
 @Post('commands/claim') @HttpCode(200)
 async claim(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  this.authenticate(auth);const workerId=this.id(body),ms=this.lease(body.leaseMs);
  const command=await this.db.transaction(async client=>{
   const result=await client.query(`SELECT c.id,c.organization_id,c.session_id,c.command FROM whatsapp_session_commands c JOIN organizations o ON o.id=c.organization_id AND o.suspended_at IS NULL WHERE c.status='queued' ORDER BY c.created_at ASC FOR UPDATE OF c SKIP LOCKED LIMIT 1`);
   const candidate=result.rows[0];if(!candidate)return null;
   const row=await client.query(`SELECT id,organization_id,status,worker_id,worker_lease_expires_at FROM whatsapp_sessions WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL FOR UPDATE`,[candidate.session_id,candidate.organization_id]);
   const session=row.rows[0];
   if(!session){await client.query(`UPDATE whatsapp_session_commands SET status='failed',last_error='Session not found',completed_at=now() WHERE id=$1`,[candidate.id]);return null;}
   if(session.worker_id&&session.worker_id!==workerId&&session.worker_lease_expires_at&&new Date(session.worker_lease_expires_at).getTime()>Date.now())return null;
   await client.query(`UPDATE whatsapp_sessions SET worker_id=$1,worker_lease_expires_at=now()+($2::bigint * interval '1 millisecond'),last_heartbeat_at=now(),updated_at=now() WHERE id=$3`,[workerId,ms,session.id]);
   await client.query(`UPDATE whatsapp_session_commands SET status='claimed',worker_id=$1,claimed_at=now(),attempts=attempts+1 WHERE id=$2`,[workerId,candidate.id]);
   return {...candidate,session:{...session,worker_id:workerId}};
  });
  return {command};
 }
 @Post('commands/complete') @HttpCode(200)
 async complete(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  this.authenticate(auth);const workerId=this.id(body),commandId=this.uuid(body.commandId);
  const result=await this.db.query(`UPDATE whatsapp_session_commands SET status='completed',completed_at=now() WHERE id=$1 AND worker_id=$2 AND status='claimed' RETURNING id`,[commandId,workerId]);
  return {ok:true,updated:result.rowCount===1};
 }
 @Post('commands/fail') @HttpCode(200)
 async fail(@Headers('authorization') auth:string|undefined,@Body() body:Input) {
  this.authenticate(auth);const workerId=this.id(body),commandId=this.uuid(body.commandId);
  const error=typeof body.error==='string'?body.error.slice(0,2000):'Worker command failed';
  const result=await this.db.query(`UPDATE whatsapp_session_commands SET status='failed',last_error=$3,completed_at=now() WHERE id=$1 AND worker_id=$2 AND status='claimed' RETURNING id`,[commandId,workerId,error]);
  return {ok:true,updated:result.rowCount===1};
 }
}
