# Optional SQLite message history (draft PR #72)

**Production deployment is on hold. No VPS changes are authorized.**

## Objective and architecture

RelayWA can optionally archive **terminal** (sent/received/failed) message
content into a **local SQLite file** while keeping PostgreSQL as the source of
truth for message dispatch, idempotency, delivery state, usage quotas, webhooks,
client subscriptions, and current API message-history views.

The Platform Admin > **Message storage** switch is **off by default**.
Turning it off prevents new rows being archived to SQLite; old SQLite records
expire normally. PostgreSQL message rows and sensitive bodies **are not yet
migrated or deleted** by this phase. Do not describe this version as a full
PostgreSQL-to-SQLite migration.

Media binary files are not stored in this archive. Only text, media captions,
filenames, sizes and delivery metadata are stored. The SQLite file is created
only if a persistent absolute location is configured and the feature is
enabled. No old messages are automatically backfilled.

## Storage budget

A practical first-pass budget for short text messages, metadata and SQLite
indexes is about **1–3 KiB per message**. Actual usage depends heavily on
text length, UTF-8 scripts, captions, indexes and SQLite WAL growth.

| Messages archived | Approximate SQLite size |
| ---: | ---: |
| 10,000 | 10–30 MiB |
| 100,000 | 100–300 MiB |
| 1,000,000 | 1–3 GiB |
| 10,000,000 | 10–30 GiB |

Plan additional temporary free space for WAL and backups. A 100 MB minimum
and 102,400 MB maximum storage cap are supported; default 1,024 MB.
Default retention 7 days; allowable range 1–365 days. Retention is based on
original message creation time. Size estimates are NOT production measurements.

## Safe future staging rollout

1. Confirm only one API process will write the SQLite file. SQLite is not a
   distributed message database; don't mount a single file read/write across
   multiple replica instances or NFS.
2. Provision a **persistent** directory and filesystem encryption/backup
   policy on the API host; mount it into the API container read/write.
3. Set `RELAYWA_MESSAGE_HISTORY_SQLITE_PATH=/data/message-history/relaywa.db`
   on the **API container only**, not the public web app.
4. Apply migration `041_optional_sqlite_message_history.sql` and earlier
   pending migrations before running the updated API.
5. Confirm the path is writable by the container user; storage files must be
   private, not shared via Nginx, static files or downloads.
6. Enable the feature via Platform Admin > System > Message storage using a
   Super Admin account and a required audit reason.
7. Send staged text, media, inbound and outbound messages. Confirm no media
   payload blob is stored, SQLite archive catches them after status becomes
   terminal, and normal PostgreSQL-based sending/quotas continue.
8. Validate retention expiry, storage cap, disk alarms, restart persistence,
   no path in API response, behavior when mount is missing or full and
   backup/restore. Verify no impact on WhatsApp auth directories.
9. Test recovery from power loss, duplicate message IDs and multiple concurrent
   sessions. Never share the SQLite file across application replicas.
10. Only later, in a **separate migration**, consider redacting delivered
    message content from PostgreSQL, after archive durability and read-path
    compatibility have been verified.

## Important privacy limitations

SQLite is not inherently encrypted at rest. Use encrypted block storage, file
permissions, restricted backups and short retention if storing personal chats.
Disabling the feature does not immediately erase previously archived SQLite
rows or purge PostgreSQL; use a separately reviewed, auditable deletion
workflow for that requirement.
