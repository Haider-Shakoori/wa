import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { authorizeEnterpriseWorker } from './enterprise-worker-authorization';

type Input = { workerId?: unknown; messageId?: unknown };
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(value)) {
    throw new ForbiddenException();
  }
  return value;
}

/** Read-only enterprise message lookup. No sending, claiming or mutation. */
@Controller('internal/enterprise-worker')
export class EnterpriseWorkerMessageController {
  constructor(private readonly db: DatabaseService) {}

  @Post('messages/lookup')
  @HttpCode(200)
  async lookup(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Input,
  ) {
    const identity = await authorizeEnterpriseWorker(this.db, authorization, body?.workerId);
    const messageId = uuid(body?.messageId);
    const result = await this.db.query(
      `SELECT m.id,m.session_id,m.status,m.direction,m.message_type
       FROM whatsapp_messages m
       JOIN whatsapp_sessions s ON s.id=m.session_id AND s.organization_id=m.organization_id
       WHERE m.id=$1 AND m.organization_id=$2 AND s.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM enterprise_workers ew
           WHERE ew.worker_id=$3 AND ew.organization_id=$2 AND ew.status='ready'
         )
       LIMIT 1`,
      [messageId, identity.organizationId, identity.workerId],
    );
    return { message: result.rows[0] ?? null };
  }
}
