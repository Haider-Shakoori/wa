export const API_SCOPES = {
  SESSIONS_READ: 'sessions.read',
  MESSAGES_READ: 'messages.read',
  MESSAGES_SEND: 'messages.send',
  CONTACTS_READ: 'contacts.read',
  CHATS_READ: 'chats.read',
  GROUPS_READ: 'groups.read',
  WEBHOOKS_READ: 'webhooks.read',
} as const;

export type ApiScope = (typeof API_SCOPES)[keyof typeof API_SCOPES];
export const ALL_API_SCOPES = Object.values(API_SCOPES);
