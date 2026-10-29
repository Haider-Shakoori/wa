import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RelayWA } from '../dist/index.js';

const root = new URL('../../../', import.meta.url);
const source = path => readFileSync(new URL(path, root), 'utf8');
const sessions = source('apps/api/src/sessions/sessions.controller.ts');
const messages = source('apps/api/src/messages/messages.controller.ts');
const directory = source('apps/api/src/directory/directory.controller.ts');
const webhooks = source('apps/api/src/webhooks/webhooks.controller.ts');

const checks = [
  [sessions, "@Controller(['whatsapp-sessions', 'v1/sessions'])", "@Get(':sessionId')", 'PERMISSIONS.SESSIONS_READ'],
  [sessions, "@Get([':sessionId/qrcode',':sessionId/qr'])", 'getQr(', 'PERMISSIONS.SESSIONS_READ'],
  [messages, "@Controller(['whatsapp-sessions/:sessionId/messages', 'v1/sessions/:sessionId/messages'])", '@Get()', 'PERMISSIONS.MESSAGES_READ'],
  [directory, "@Get('contacts')", "@Get('chats')", 'PERMISSIONS.CONTACTS_READ'],
  [directory, "@Get('groups')", 'PERMISSIONS.GROUPS_READ', 'PERMISSIONS.CHATS_READ'],
  [webhooks, "@Controller(['webhooks', 'v1/webhooks'])", "@Get(':endpointId/deliveries')", 'PERMISSIONS.WEBHOOKS_READ'],
  [messages, "@Post('text')", 'PERMISSIONS.MESSAGES_SEND', 'sendText('],
];

test('backend controller source retains the SDK route and permission contract', () => {
  for (const [file, ...needles] of checks) for (const needle of needles)
    assert.ok(file.includes(needle), 'Backend contract missing: ' + needle);
});

test('SDK read-only methods map to controller-backed paths', async () => {
  const calls = [];
  const sdk = new RelayWA({sessionKey:'offline-test',fetch:async (url, opts) => {
    calls.push([new URL(url).pathname, opts.method]);
    return new Response('{}', {status:200});
  }});
  await sdk.sessions.list();
  await sdk.sessions.get('session');
  await sdk.sessions.qrCode('session');
  await sdk.sessions.messages('session');
  await sdk.sessions.contacts('session');
  await sdk.sessions.chats('session');
  await sdk.sessions.groups('session');
  await sdk.webhooks.list();
  await sdk.webhooks.deliveries('hook');
  assert.deepEqual(calls, [
    ['/api/whatsapp-sessions','GET'],
    ['/api/whatsapp-sessions/session','GET'],
    ['/api/whatsapp-sessions/session/qrcode','GET'],
    ['/api/whatsapp-sessions/session/messages','GET'],
    ['/api/whatsapp-sessions/session/contacts','GET'],
    ['/api/whatsapp-sessions/session/chats','GET'],
    ['/api/whatsapp-sessions/session/groups','GET'],
    ['/api/webhooks','GET'],
    ['/api/webhooks/hook/deliveries','GET'],
  ]);
});
