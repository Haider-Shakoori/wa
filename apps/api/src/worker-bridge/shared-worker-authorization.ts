import { ForbiddenException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';

/**
 * Transitional security gate: legacy dispatch credentials are ONLY valid for
 * shared workers. Enterprise workers remain disabled until individual
 * credentials and endpoint-level organization authorization are implemented.
 */
export async function authorizeSharedWorker(
  db: DatabaseService,
  authorization: string | undefined,
  workerId: unknown,
): Promise<string> {
  const secret = process.env.WORKER_DISPATCH_SECRET;
  if (!secret || !authorization?.startsWith('Bearer ')) throw new ForbiddenException();
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new ForbiddenException();
  }
  if (typeof workerId !== 'string' || !/^[a-zA-Z0-9._:-]{1,120}$/.test(workerId)) {
    throw new ForbiddenException();
  }
  // Fail closed if the enterprise registry is unavailable or the identity is
  // reserved by an enterprise worker, regardless of its provisioning status.
  const result = await db.query(
    'SELECT 1 FROM enterprise_workers WHERE worker_id=$1 LIMIT 1',
    [workerId],
  );
  if (result.rowCount) throw new ForbiddenException();
  return workerId;
}
