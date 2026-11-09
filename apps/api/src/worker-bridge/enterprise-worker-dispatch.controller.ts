import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { authorizeEnterpriseWorker } from './enterprise-worker-authorization';

type Input = Record<string, unknown>;
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(value)) throw new ForbiddenException();
  return value;
}
/** Dedicated enterprise-only operations. All writes bind worker AND organization. */
@Controller('internal/enterprise-worker')
export class EnterpriseWorkerDispatchController {
  constructor(private readonly db: DatabaseService) {}
  private async identity(header: string | undefined, body: Input) {
    return authorizeEnterpriseWorker(this.db, header, body?.workerId);
  }

  @Post('commands/claim') @HttpCode(200)
  async claimCommand(@Headers('authorization') h: string | undefined, @Body() b: Input) {
    const w = await this.identity(h,b), id = uuid(b.commandId);
    const r = await this.db.query(
      `UPDATE whatsapp_session_commands c SET status='claimed',worker_id=$3,claimed_at=now(),attempts=attempts+1
       FROM whatsapp_sessions s WHERE c.id=$1 AND c.organization_id=$2 AND c.session_id=s.id
       AND s.organization_id=$2 AND s.worker_id=$3 AND s.deleted_at IS NULL
       AND c.status='queued' AND EXISTS(SELECT 1 FROM enterprise_workers ew
         WHERE ew.worker_id=$3 AND ew.organization_id=$2 AND ew.status='ready')
       RETURNING c.id,c.session_id,c.command`,
      [id,w.organizationId,w.workerId],
    );
    return {command:r.rows[0]??null};
  }

  @Post('commands/complete') @HttpCode(200)
  async completeCommand(@Headers('authorization') h: string | undefined, @Body() b: Input) {
    const w = await this.identity(h,b), id = uuid(b.commandId);
    const r = await this.db.query(
      `UPDATE whatsapp_session_commands c SET status='completed',completed_at=now()
       FROM whatsapp_sessions s WHERE c.id=$1 AND c.organization_id=$2 AND c.worker_id=$3
       AND c.session_id=s.id AND s.organization_id=$2 AND s.worker_id=$3
       AND c.status='claimed' RETURNING c.id`,
      [id,w.organizationId,w.workerId],
    );
    return {updated:r.rowCount===1};
  }

  @Post('messages/claim') @HttpCode(200)
  async claimMessage(@Headers('authorization') h: string | undefined, @Body() b: Input) {
    const w = await this.identity(h,b), id = uuid(b.messageId);
    if (typeof b.stripeLivemode !== 'boolean') throw new ForbiddenException();
    const r = await this.db.query(
      `UPDATE whatsapp_messages m SET status='claimed',worker_id=$3,claimed_at=now(),attempts=attempts+1,updated_at=now()
       FROM whatsapp_sessions s,organizations o,organization_subscriptions sub
       WHERE m.id=$1 AND m.organization_id=$2 AND m.session_id=s.id
       AND s.organization_id=$2 AND s.worker_id=$3 AND s.deleted_at IS NULL
       AND s.status='connected' AND s.worker_lease_expires_at>now()
       AND o.id=$2 AND o.suspended_at IS NULL AND sub.organization_id=$2
       AND sub.status IN ('trialing','active')
       AND (sub.provider IS DISTINCT FROM 'stripe' OR sub.stripe_livemode=$4)
       AND sub.current_period_end>now()
       AND (sub.status<>'trialing' OR sub.trial_ends_at IS NULL OR sub.trial_ends_at>now())
       AND m.direction='outbound' AND m.status='queued'
       AND EXISTS(SELECT 1 FROM enterprise_workers ew
         WHERE ew.worker_id=$3 AND ew.organization_id=$2 AND ew.status='ready')
       RETURNING m.*`,
      [id,w.organizationId,w.workerId,b.stripeLivemode],
    );
    return {message:r.rows[0]??null};
  }

  @Post('messages/sent') @HttpCode(200)
  async sent(@Headers('authorization') h: string | undefined, @Body() b: Input) {
    const w = await this.identity(h,b), id = uuid(b.messageId);
    const provider = typeof b.providerMessageId==='string' ? b.providerMessageId.slice(0,180) : null;
    const r = await this.db.query(
      `UPDATE whatsapp_messages m SET status='sent',provider_message_id=$4,sent_at=now(),last_error=NULL,bull_job_id=NULL,updated_at=now()
       FROM whatsapp_sessions s WHERE m.id=$1 AND m.organization_id=$2 AND m.worker_id=$3
       AND m.session_id=s.id AND s.organization_id=$2 AND s.worker_id=$3
       AND m.status='claimed' AND m.direction='outbound' RETURNING m.id`,
      [id,w.organizationId,w.workerId,provider],
    );
    return {updated:r.rowCount===1};
  }

  @Post('messages/failed') @HttpCode(200)
  async failed(@Headers('authorization') h: string | undefined, @Body() b: Input) {
    const w = await this.identity(h,b), id = uuid(b.messageId);
    const reason = typeof b.error==='string' ? b.error.slice(0,2000) : 'Worker delivery failed';
    const r = await this.db.query(
      `UPDATE whatsapp_messages m SET status='failed',last_error=$4,failed_at=now(),bull_job_id=NULL,updated_at=now()
       FROM whatsapp_sessions s WHERE m.id=$1 AND m.organization_id=$2 AND m.worker_id=$3
       AND m.session_id=s.id AND s.organization_id=$2 AND s.worker_id=$3
       AND m.status='claimed' AND m.direction='outbound' RETURNING m.id`,
      [id,w.organizationId,w.workerId,reason],
    );
    return {updated:r.rowCount===1};
  }
}
