import { ForbiddenException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

export type EnterpriseWorkerIdentity = {
  workerId: string;
  organizationId: string;
};

/**
 * Authenticates a dedicated worker using a per-worker token stored only as a
 * digest. Registry status, credential revocation and worker identity must all
 * match. This is not yet wired into the worker endpoints.
 */
export async function authorizeEnterpriseWorker(
  db: DatabaseService,
  authorization: string | undefined,
  workerId: unknown,
): Promise<EnterpriseWorkerIdentity> {
  if (typeof workerId !== 'string' || !/^enterprise-[a-zA-Z0-9-]{1,110}$/.test(workerId)) {
    throw new ForbiddenException();
  }
  if (!authorization?.startsWith('Bearer ')) throw new ForbiddenException();
  const token = authorization.slice(7);
  if (!/^[a-fA-F0-9]{64}$/.test(token)) throw new ForbiddenException();
  const digest = createHash('sha256').update(token, 'utf8').digest('hex');
  const result = await db.query(
    `SELECT ew.worker_id, ew.organization_id, ec.token_sha256
       FROM enterprise_workers ew
       JOIN enterprise_worker_credentials ec ON ec.worker_id = ew.worker_id
       WHERE ew.worker_id=$1 AND ew.status='ready' AND ec.revoked_at IS NULL`,
    [workerId],
  );
  if (result.rows.length !== 1) throw new ForbiddenException();
  const expected = Buffer.from(String(result.rows[0].token_sha256), 'hex');
  const supplied = Buffer.from(digest, 'hex');
  if (expected.length !== 32 || !timingSafeEqual(expected, supplied)) {
    throw new ForbiddenException();
  }
  return {
    workerId: String(result.rows[0].worker_id),
    organizationId: String(result.rows[0].organization_id),
  };
}
