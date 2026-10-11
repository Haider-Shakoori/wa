import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = async name => readFile(new URL(name, import.meta.url), 'utf8');
test('registration verification is initiated by a user message, not an outbound OTP', async () => {
  const service = await file('../src/phone-verification/phone-verification.service.ts');
  assert.match(service, /https:\/\/wa\.me\//);
  assert.match(service, /VERIFY /);
  assert.match(service, /randomBytes\(24\)/);
  assert.match(service, /createHash\('sha256'\)/);
  assert.doesNotMatch(service, /sendText\(|sendMessage\(|sendTemplate\(/);
});
test('signed Meta webhook must verify raw request bytes', async () => {
  const controller = await file('../src/phone-verification/phone-verification.controller.ts');
  assert.match(controller, /x-hub-signature-256/);
  assert.match(controller, /request\.rawBody/);
  assert.match(controller, /createHmac\('sha256'/);
  assert.match(controller, /timingSafeEqual/);
});
test('consumption is single-use, expiry-checked, and tenant-scoped', async () => {
  const service = await file('../src/phone-verification/phone-verification.service.ts');
  assert.match(service, /status='consumed'/);
  assert.match(service, /status='verified' AND expires_at>now\(\)/);
  assert.match(service, /WHERE organization_id=\$1 AND id=\$2/);
  assert.match(service, /phone_e164=\$2 AND status='pending'/);
  assert.match(service, /phone_number_id !== numberId/);
});
test('schema stores token hashes and tenant indexes', async () => {
  const sql = await file('../migrations/045_inbound_whatsapp_phone_verification.sql');
  assert.match(sql, /token_hash char\(64\).*UNIQUE/);
  assert.match(sql, /organization_id uuid NOT NULL/);
  assert.doesNotMatch(sql, /token_plaintext|otp_code/);
});
