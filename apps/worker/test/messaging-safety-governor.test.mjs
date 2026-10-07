import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Safety Governor enforces pacing, burst and long-window limits', async () => {
  const source = await readFile(new URL('../src/message-queue.js', import.meta.url), 'utf8');
  assert.match(source, /claimSessionSendSlot/);
  assert.match(source, /randomBetween/);
  assert.match(source, /messagesPerMinute/);
  assert.match(source, /messagesPerHour/);
  assert.match(source, /burstLimit/);
  assert.match(source, /rescheduleMessageForSafety/);
});

test('Safety Governor suppresses duplicates and expires stale queue items', async () => {
  const source = await readFile(new URL('../src/message-queue.js', import.meta.url), 'utf8');
  assert.match(source, /registerDuplicateGuard/);
  assert.match(source, /duplicate_suppressed/);
  assert.match(source, /maxQueueAgeSeconds/);
  assert.match(source, /markMessageQueueExpired/);
});

test('repeated final failures automatically pause API messaging', async () => {
  const queue = await readFile(new URL('../src/message-queue.js', import.meta.url), 'utf8');
  const store = await readFile(new URL('../src/session-store.js', import.meta.url), 'utf8');
  assert.match(queue, /recordFailureWindow/);
  assert.match(queue, /failurePauseThreshold/);
  assert.match(queue, /pauseSessionMessaging/);
  assert.match(store, /messaging_paused_until/);
  assert.match(store, /session\.messaging_safety_paused/);
});
