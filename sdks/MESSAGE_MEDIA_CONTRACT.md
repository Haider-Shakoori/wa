# RelayWA message and media contract (source-verified)

- `POST /api/send-message` uses `ApiAccessGuard`, `SessionKeyGuard`, `PermissionGuard`, and `MESSAGES_SEND`. Its response wraps the queued message in `{success:true,data:...}`.
- Text DTO requires `to` length 7–32, `text` length 1–4096, and optional `clientMessageId` up to 120 characters. Scheduling and retry options are also defined by the backend DTO.
- Legacy media routes: `POST /api/send-image`, `send-video`, `send-audio`, `send-document`. Session-specific equivalents: `POST /api/whatsapp-sessions/:sessionId/messages/{image,video,audio,document}`.
- Media JSON requires `to`, HTTPS `url`, `mimeType`, and `mediaSizeBytes`; optional `fileName`, `caption`, `voiceNote`, and dispatch options. The backend validates media URL safety and MIME type.
- Size caps: image 16 MiB, video 64 MiB, audio 16 MiB, document 100 MiB.
- Multipart file upload is a separate session route `POST /api/whatsapp-sessions/:sessionId/messages/file`, with field `file` and form fields `to`, `type`, optional `caption`.

These are source-level contracts. The SDK currently implements text sending, not the media methods above. Do not advertise media SDK support until implemented and tested. Do not send live traffic as part of CI.
