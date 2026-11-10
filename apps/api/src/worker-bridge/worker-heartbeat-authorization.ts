import { ForbiddenException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { authorizeSharedWorker } from './shared-worker-authorization';

/** Dedicated standby tokens authorize ONLY process heartbeat, never session operations. */
export async function authorizeWorkerHeartbeat(
  db: DatabaseService, authorization: string | undefined, workerId: unknown,
): Promise<string> {
  if (!authorization?.startsWith('Bearer ')) throw new ForbiddenException();
  const token = authorization.slice(7);
  if (!token || token.length > 512) throw new ForbiddenException();
  // Preserve the current shared worker heartbeat path for existing deployments.
  const legacy = process.env.WORKER_DISPATCH_SECRET;
  if (legacy) {
    const actual = Buffer.from(token);
    const expected = Buffer.from(legacy);
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
      return authorizeSharedWorker(db, authorization, workerId);
    }
  }
  if (typeof workerId !== 'string' || !/^relaywa-worker-[a-z0-9-]{1,100}$/.test(workerId)) throw new ForbiddenException();
  const result = await db.query(
    'SELECT token_sha256 FROM relaywa_standby_worker_credentials WHERE worker_id=$1 AND enabled=true AND revoked_at IS NULL LIMIT 1',
    [workerId],
  );
  const stored = result.rows[0]?.token_sha256;
  if (typeof stored !== 'string' || !/^[0-9a-f]{64}$/.test(stored)) throw new ForbiddenException();
  const supplied = createHash('sha256').update(token).digest();
  const expected = Buffer.from(stored, 'hex');
  if (!timingSafeEqual(supplied, expected)) throw new ForbiddenException();
  return workerId;
}
