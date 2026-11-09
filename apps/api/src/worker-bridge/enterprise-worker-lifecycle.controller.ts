import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { authorizeEnterpriseWorker } from './enterprise-worker-authorization';
import { trustedEnterpriseStripeLivemode } from './enterprise-worker-billing-mode';
type Input = Record<string, unknown>;
function uuid(v:unknown):string {
 if(typeof v!=='string'||!/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(v))throw new ForbiddenException();
 return v;
}
function integer(v:unknown,min:number,max:number):number {
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min||v>max)throw new ForbiddenException();
 return v;
}
@Controller('internal/enterprise-worker')
export class EnterpriseWorkerLifecycleController {
 constructor(private readonly db:DatabaseService){}
 private auth(h:string|undefined,b:Input){return authorizeEnterpriseWorker(this.db,h,b?.workerId);}

 @Post('sessions/heartbeat') @HttpCode(200)
 async heartbeat(@Headers('authorization') h:string|undefined,@Body() b:Input) {
  const w=await this.auth(h,b),id=uuid(b.sessionId),lease=integer(b.leaseMs,1000,300000);
  const r=await this.db.query(
   `UPDATE whatsapp_sessions SET worker_lease_expires_at=now()+($4::bigint*interval '1 millisecond'),
    last_heartbeat_at=now(),updated_at=now() WHERE id=$1 AND organization_id=$2 AND worker_id=$3
    AND deleted_at IS NULL RETURNING id`,[id,w.organizationId,w.workerId,lease]);
  return {updated:r.rowCount===1};
 }

 @Post('sessions/recoverable') @HttpCode(200)
 async recoverable(@Headers('authorization') h:string|undefined,@Body() b:Input) {
  const w=await this.auth(h,b),limit=integer(b.limit,1,100),stale=integer(b.connectingStaleMs,0,3600000),lease=integer(b.leaseMs,1000,300000);
  const r=await this.db.query(
   `WITH candidates AS (
     SELECT s.id FROM whatsapp_sessions s WHERE s.organization_id=$1 AND s.deleted_at IS NULL
     AND s.status IN ('connecting','connected','reconnecting','disconnected')
     AND (s.worker_lease_expires_at IS NULL OR s.worker_lease_expires_at<=now())
     AND (s.status<>'connecting' OR s.updated_at<=now()-($4::bigint*interval '1 millisecond'))
     AND EXISTS(SELECT 1 FROM enterprise_workers ew WHERE ew.worker_id=$2 AND ew.organization_id=$1 AND ew.status='ready')
     ORDER BY s.updated_at ASC FOR UPDATE OF s SKIP LOCKED LIMIT $3
    ) UPDATE whatsapp_sessions s SET worker_id=$2,
     worker_lease_expires_at=now()+($5::bigint*interval '1 millisecond'),
     recovery_started_at=now(),recovery_reason='worker_startup',updated_at=now()
    FROM candidates c WHERE s.id=c.id AND s.organization_id=$1
    RETURNING s.id,s.status,s.reconnect_attempts`,[w.organizationId,w.workerId,limit,stale,lease]);
  return {sessions:r.rows};
 }

 @Post('messages/poll') @HttpCode(200)
 async poll(@Headers('authorization') h:string|undefined,@Body() b:Input) {
  const w=await this.auth(h,b);
  const stripeLivemode=trustedEnterpriseStripeLivemode();
  const message=await this.db.transaction(async client=>{
   const r=await client.query(
    `SELECT m.id FROM whatsapp_messages m JOIN whatsapp_sessions s
     ON s.id=m.session_id AND s.organization_id=m.organization_id
     JOIN organizations o ON o.id=m.organization_id AND o.suspended_at IS NULL
     JOIN organization_subscriptions sub ON sub.organization_id=m.organization_id
     WHERE m.organization_id=$1 AND s.worker_id=$2 AND s.deleted_at IS NULL
     AND s.status='connected' AND s.worker_lease_expires_at>now()
     AND m.direction='outbound' AND m.status='queued'
     AND sub.status IN ('trialing','active')
     AND (sub.provider IS DISTINCT FROM 'stripe' OR sub.stripe_livemode=$3)
     AND sub.current_period_end>now()
     AND (sub.status<>'trialing' OR sub.trial_ends_at IS NULL OR sub.trial_ends_at>now())
     AND EXISTS(SELECT 1 FROM enterprise_workers ew WHERE ew.worker_id=$2 AND ew.organization_id=$1 AND ew.status='ready')
     ORDER BY m.queued_at ASC FOR UPDATE OF m SKIP LOCKED LIMIT 1`,
    [w.organizationId,w.workerId,stripeLivemode]);
   if(!r.rows[0])return null;
   const updated=await client.query(
    `UPDATE whatsapp_messages SET status='claimed',worker_id=$2,claimed_at=now(),
     attempts=attempts+1,updated_at=now() WHERE id=$1 AND organization_id=$3
     AND status='queued' RETURNING *`,[r.rows[0].id,w.workerId,w.organizationId]);
   return updated.rows[0]??null;
  });
  return {message};
 }

 @Post('commands/fail') @HttpCode(200)
 async failCommand(@Headers('authorization') h:string|undefined,@Body() b:Input) {
  const w=await this.auth(h,b),id=uuid(b.commandId),error=typeof b.error==='string'?b.error.slice(0,2000):'Worker command failed';
  const r=await this.db.query(
   `UPDATE whatsapp_session_commands c SET status='failed',last_error=$4,completed_at=now()
    FROM whatsapp_sessions s WHERE c.id=$1 AND c.organization_id=$2 AND c.worker_id=$3
    AND c.session_id=s.id AND s.organization_id=$2 AND s.worker_id=$3
    AND c.status='claimed' RETURNING c.id`,[id,w.organizationId,w.workerId,error]);
  return {updated:r.rowCount===1};
 }
}
