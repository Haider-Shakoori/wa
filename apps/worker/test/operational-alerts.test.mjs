import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('critical session events are mapped to operational alerts', async () => {
  const source = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(source, /session\.logged_out/);
  assert.match(source, /session\.auth_failure/);
  assert.match(source, /session\.auth_corrupt/);
  assert.match(source, /ALERT_RECONNECT_THRESHOLD/);
  assert.match(source, /queueSessionAlert/);
});

test('permanent failures queue deduplicated operational alerts', async () => {
  const source = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(source, /message\.failed/);
  assert.match(source, /webhook\.failed/);
  assert.match(source, /session\.command_failed/);
  assert.match(source, /session\.recovery_failed/);
  assert.match(source, /dedupe_key/);
});

test('SMTP delivery uses platform admin recipients when no override is configured', async () => {
  const source = await readFile(new URL('../src/operational-alerts.js', import.meta.url), 'utf8');
  assert.match(source, /SMTP_HOST/);
  assert.match(source, /ALERT_EMAIL_TO/);
  assert.match(source, /listPlatformAdminEmails/);
  assert.match(source, /RELAYWA_ADMIN_EMAIL/);
  assert.match(source, /sendMail/);
});

test('worker delivery loop retries operational email alerts', async () => {
  const source = await readFile(new URL('../src/command-loop.js', import.meta.url), 'utf8');
  assert.match(source, /claimNextSystemAlert/);
  assert.match(source, /markSystemAlertSent/);
  assert.match(source, /rescheduleSystemAlert/);
});
