export const PERMISSIONS = {
  ORGANIZATION_READ: 'organization.read',
  MEMBERS_READ: 'members.read',
  MEMBERS_MANAGE: 'members.manage',
  SESSIONS_READ: 'sessions.read',
  SESSIONS_MANAGE: 'sessions.manage',
  MESSAGES_SEND: 'messages.send',
  WEBHOOKS_MANAGE: 'webhooks.manage',
  BILLING_MANAGE: 'billing.manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type OrganizationRole = 'owner' | 'admin' | 'developer' | 'member' | 'viewer';

export const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  owner: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_MANAGE,
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.WEBHOOKS_MANAGE,
  ],
  developer: [
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.SESSIONS_MANAGE,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.WEBHOOKS_MANAGE,
  ],
  member: [
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.SESSIONS_READ,
    PERMISSIONS.MESSAGES_SEND,
  ],
  viewer: [
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.SESSIONS_READ,
  ],
};
