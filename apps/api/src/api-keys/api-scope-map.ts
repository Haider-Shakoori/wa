import { PERMISSIONS, type Permission } from '../auth/permissions';
import { API_SCOPES } from './api-scopes';

export const PERMISSION_TO_API_SCOPE: Partial<Record<Permission, string>> = {
  [PERMISSIONS.SESSIONS_READ]: API_SCOPES.SESSIONS_READ,
  [PERMISSIONS.MESSAGES_SEND]: API_SCOPES.MESSAGES_SEND,
};
