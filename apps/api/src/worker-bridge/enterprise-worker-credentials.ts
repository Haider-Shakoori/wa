import { randomBytes, createHash } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * Administrative primitive only. Call from an authenticated, audited
 * provisioning operation; NEVER expose this function as a public route.
 * The plaintext credential is returned once to the caller and not logged.
 */
export async function rotateEnterpriseWorkerCredential(
  db: DatabaseService,
  workerId: string,
  organizationId: string,
): Promise<string> {
  if (!/^enterprise-[a-zA-Z0-9-]{1,110}$/.test(workerId) || !organizationId) {
    throw new ForbiddenException();
  }
  const token = randomBytes(32).toString('hex');
  const digest = createHash('sha256').update(token, 'utf8').digest('hex');
  const result = await db.query(
    `INSERT INTO enterprise_worker_credentials(worker_id,token_sha256,created_at,rotated_at,revoked_at)
     SELECT ew.worker_id,$3,now(),now(),NULL
     FROM enterprise_workers ew
     WHERE ew.worker_id=$1 AND ew.organization_id=$2 AND ew.status IN ('pending','provisioning','ready','disabled')
     ON CONFLICT(worker_id) DO UPDATE
     SET token_sha256=EXCLUDED.token_sha256,rotated_at=now(),revoked_at=NULL
     RETURNING worker_id`,
    [workerId, organizationId, digest],
  );
  if (result.rowCount !== 1) throw new ForbiddenException();
  return token;
}

/** Revocation takes effect on the next authenticated worker request. */
export async function revokeEnterpriseWorkerCredential(
  db: DatabaseService,
  workerId: string,
  organizationId: string,
): Promise<boolean> {
  if (!/^enterprise-[a-zA-Z0-9-]{1,110}$/.test(workerId) || !organizationId) {
    throw new ForbiddenException();
  }
  const result = await db.query(
    `UPDATE enterprise_worker_credentials ec SET revoked_at=now()
     FROM enterprise_workers ew
     WHERE ec.worker_id=ew.worker_id AND ew.worker_id=$1 AND ew.organization_id=$2
     AND ec.revoked_at IS NULL RETURNING ec.worker_id`,
    [workerId, organizationId],
  );
  return result.rowCount === 1;
}
