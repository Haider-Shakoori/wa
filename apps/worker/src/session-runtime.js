export const SESSION_LEASE_MS = Number(process.env.SESSION_LEASE_MS ?? 45000);

export function canOwnSession(session, workerId, now = Date.now()) {
  if (!session.worker_id) return true;
  if (session.worker_id === workerId) return true;
  if (!session.worker_lease_expires_at) return true;
  return new Date(session.worker_lease_expires_at).getTime() <= now;
}

export function nextLeaseExpiry(now = Date.now()) {
  return new Date(now + SESSION_LEASE_MS).toISOString();
}

export function lifecycleTarget(command) {
  switch (command) {
    case 'connect':
      return 'connecting';
    case 'restart':
      return 'reconnecting';
    case 'logout':
      return 'logged_out';
    default:
      throw new Error(`Unsupported lifecycle command: ${command}`);
  }
}
