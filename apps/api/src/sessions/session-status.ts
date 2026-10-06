export const SESSION_STATUSES = [
  'pending',
  'need_scan',
  'connecting',
  'connected',
  'disconnected',
  'reconnecting',
  'logged_out',
  'expired',
  'error',
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const ACTIVE_SESSION_STATUSES: readonly SessionStatus[] = [
  'need_scan',
  'connecting',
  'connected',
  'reconnecting',
];
