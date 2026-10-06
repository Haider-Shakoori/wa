import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('external API auth and scoped guards are wired', async () => {
  const access = await readFile(new URL('../src/auth/api-access.guard.ts', import.meta.url), 'utf8');
  const permission = await readFile(new URL('../src/auth/permission.guard.ts', import.meta.url), 'utf8');
  assert.match(access, /rw_live_/);
  assert.match(access, /rw_session_/);
  assert.match(permission, /PERMISSION_TO_API_SCOPE/);
  assert.match(permission, /sessionId/);
});

test('external resource controllers use ApiAccessGuard', async () => {
  for (const file of [
    '../src/messages/messages.controller.ts',
    '../src/sessions/sessions.controller.ts',
    '../src/directory/directory.controller.ts',
  ]) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /ApiAccessGuard/);
  }
});
