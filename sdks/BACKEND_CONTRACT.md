# RelayWA SDK backend contract inventory

Verified against NestJS controller source (not a live API integration test). The app applies the global `/api` prefix.

| SDK method / feature | Backend route | Required permission |
|---|---|---|
| sessions.list | GET /api/whatsapp-sessions | SESSIONS_READ |
| sessions.get | GET /api/whatsapp-sessions/:sessionId | SESSIONS_READ |
| sessions.qrCode | GET /api/whatsapp-sessions/:sessionId/qrcode | SESSIONS_READ |
| sessions.messages | GET /api/whatsapp-sessions/:sessionId/messages | MESSAGES_READ |
| sessions.contacts | GET /api/whatsapp-sessions/:sessionId/contacts | CONTACTS_READ |
| sessions.chats | GET /api/whatsapp-sessions/:sessionId/chats | CHATS_READ |
| sessions.groups | GET /api/whatsapp-sessions/:sessionId/groups | GROUPS_READ |
| webhooks.list | GET /api/webhooks | WEBHOOKS_READ |
| webhooks.deliveries | GET /api/webhooks/:endpointId/deliveries | WEBHOOKS_READ |
| messages.send | POST /api/send-message | Verify legacy route guard and payload separately |
| Session text messaging | POST /api/whatsapp-sessions/:sessionId/messages/text | MESSAGES_SEND |
| Session media | POST /api/whatsapp-sessions/:sessionId/messages/image, video, audio, document | MESSAGES_SEND |
| Session file upload | POST /api/whatsapp-sessions/:sessionId/messages/file | MESSAGES_SEND; multipart file |

The test reads repository controller source and uses a fake fetch transport. It cannot establish deployed API behavior, real key scope, response shapes, webhook signatures, or package registry readiness. Do not use live customer sessions for contract testing.
