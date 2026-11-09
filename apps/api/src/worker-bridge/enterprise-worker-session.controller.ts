import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { authorizeEnterpriseWorker } from './enterprise-worker-authorization';

type Input = { workerId?: unknown; sessionId?: unknown };
const uuid = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(value)) {
    throw new ForbiddenException();
  }
  return value;
};

/** Read-only enterprise session operations, strictly scoped to credential org. */
@Controller('internal/enterprise-worker')
export class EnterpriseWorkerSessionController {
  constructor(private readonly db: DatabaseService) {}

  @Post('sessions/lookup')
  @HttpCode(200)
  async lookup(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Input,
  ) {
    const identity = await authorizeEnterpriseWorker(this.db, authorization, body?.workerId);
    const sessionId = uuid(body?.sessionId);
    const result = await this.db.query(
      `SELECT id,status,worker_id FROM whatsapp_sessions
       WHERE id=$1 AND organization_id=$2 AND worker_id=$3 AND deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM enterprise_workers ew
           WHERE ew.worker_id=$3 AND ew.organization_id=$2 AND ew.status='ready'
         )
       LIMIT 1`,
      [sessionId, identity.organizationId, identity.workerId],
    );
    // Identical response for missing and foreign-organization sessions.
    return { session: result.rows[0] ?? null };
  }
}
