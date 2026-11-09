import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { authorizeEnterpriseWorker } from './enterprise-worker-authorization';

type HeartbeatInput = { workerId?: unknown };

/**
 * Dedicated worker endpoint deliberately separate from legacy shared-worker
 * routes. Does not grant access to sessions, messages or command claims.
 */
@Controller('internal/enterprise-worker')
export class EnterpriseWorkerHeartbeatController {
  constructor(private readonly db: DatabaseService) {}

  @Post('heartbeat')
  @HttpCode(200)
  async heartbeat(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: HeartbeatInput,
  ) {
    const identity = await authorizeEnterpriseWorker(this.db, authorization, body?.workerId);
    const result = await this.db.query(
      `UPDATE enterprise_workers SET last_heartbeat_at=now(),updated_at=now()
       WHERE worker_id=$1 AND organization_id=$2 AND status='ready'`,
      [identity.workerId, identity.organizationId],
    );
    if (result.rowCount !== 1) throw new ForbiddenException();
    return { ok: true };
  }
}
