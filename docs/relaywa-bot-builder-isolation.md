# RelayWA Bot Builder — isolated development baseline

## Safety guarantee
This branch is **not deployed**. The active edge worker and standby worker-02 remain unchanged.
The new FAQ decision engine is a pure importable module: it performs no I/O, makes
no WhatsApp connection, never claims commands, never performs outbound sends, and
cannot change session ownership.

## MVP API and UI contract (not yet implemented)
- UI: /dashboard/bots, /dashboard/bots/:id, /dashboard/knowledge-base
- API: tenant-authenticated CRUD for bots, FAQ entries, handoff rules, testing.
- Required storage: bot_id, tenant_id, session_id, mode (default standby),
  FAQ entries, message dedupe, handoff state, audit logs.
- Messages: only independently validated inbound text events for explicitly
  assigned test session IDs may reach the bot, never production sessions.
- Sender: controlled outbound adapter with idempotency key and approval of
  each customer/session opt-in. Never route through worker-01 as a shortcut.
- Add retention policy, role checks, encryption, rate limiting, and audits.
- Keep AI and document uploads disabled until reviewed and tested.

## Release gates
1. Test coverage for tenant ownership, duplicates, paused conversations,
   live-session exclusion, reconnects, and bilingual FAQs.
2. Separate database/schema, credentials, queues, and WhatsApp session directory.
3. Worker-02 must remain heartbeat-only until explicit activation is approved.
4. Stage with a **new test WhatsApp number**, verify no worker-01 regression.
5. Feature flag off for all existing tenants, gradual opt-in, rollback to standby.

## Current delivery
Only the deterministic FAQ core, validation and unit tests are in this branch.
No dashboard/API/storage/inbound routing/deployment has been implemented yet.
