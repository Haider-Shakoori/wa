import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const load=path=>readFile(new URL(path,import.meta.url),'utf8');

test('SQLite history is disabled by default, with bounded retention and space caps',async()=>{
 const sql=await load('../migrations/041_optional_sqlite_message_history.sql');
 assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
 assert.match(sql,/retention_days integer NOT NULL DEFAULT 7/);
 assert.match(sql,/max_file_mb integer NOT NULL DEFAULT 1024/);
 assert.match(sql,/CHECK \(retention_days BETWEEN 1 AND 365\)/);
 assert.match(sql,/INSERT INTO message_history_storage_settings/);
});

test('SQLite content archive is opt-in, isolated from dispatch and stores no media blobs',async()=>{
 const source=await load('../src/message-history/sqlite-message-history.service.ts');
 assert.match(source,/RELAYWA_MESSAGE_HISTORY_SQLITE_PATH/);
 assert.match(source,/if\(!settings.enabled\|\|!settings.enabled_at\)return/);
 assert.match(source,/created_at >= \$1::timestamptz/);
 assert.match(source,/status IN \('sent','received','failed'\)/);
 assert.match(source,/INSERT INTO message_history/);
 assert.match(source,/ON CONFLICT\(id\) DO UPDATE/);
 assert.match(source,/DELETE FROM message_history WHERE created_at<\?/);
 assert.match(source,/PRAGMA journal_mode=WAL/);
 assert.match(source,/chmodSync\(this.location,0o600\)/);
 assert.doesNotMatch(source,/media_blob BLOB|media_content BLOB|Buffer\.from\(.*media/);
 const module=await load('../src/app.module.ts');
 assert.match(module,/MessageHistoryModule/);
});

test('Only super admins may change SQLite history settings; no VPS path is exposed',async()=>{
 const [ctrl,dto,service]=await Promise.all([
  load('../src/platform/platform-admin.controller.ts'),
  load('../src/platform/platform-admin.dto.ts'),
  load('../src/platform/platform-admin.service.ts'),
 ]);
 assert.match(ctrl,/@Get\('settings\/message-history'\)/);
 assert.match(ctrl,/@Patch\('settings\/message-history'\)\s+@PlatformRoles\('super_admin'\)/);
 assert.match(dto,/class UpdateMessageHistoryStorageDto/);
 const block=service.slice(service.indexOf('  async messageHistoryStorageSettings('),service.indexOf('  async messagingEngineSettings('));
 assert.match(block,/sqliteHistory\.configured/);
 assert.match(block,/message\.history\.storage\.updated/);
 assert.match(block,/this\.db\.transaction\(async client/);
 assert.doesNotMatch(block,/this\.sqliteHistory\.location/);
});

test('Platform Settings offers readable SQLite storage toggle and retention options',async()=>{
 const [page,form,css]=await Promise.all([
  load('../../web/app/platform/page.tsx'),
  load('../../web/components/platform-message-history-storage.tsx'),
  load('../../web/app/globals.css'),
 ]);
 assert.match(page, /'Message storage'/);
 assert.match(page, /<PlatformMessageHistoryStorage/);
 assert.match(form,/Enable SQLite message history/);
 assert.match(form,/Retain history \(days\)/);
 assert.match(form,/SQLite storage limit \(MB\)/);
 assert.match(form,/method:'PATCH'/);
 assert.match(form,/!settings\.configured/);
 assert.match(form,/PostgreSQL message records/);
 assert.match(css,/\.sqlite-history-form/);
});
