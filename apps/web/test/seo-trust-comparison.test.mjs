import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Public help makes official vs QR account-risk and consent disclosures with primary sources',()=>{
  const help=read('app/help/page.tsx');
  assert.match(help,/Meta Cloud API versus QR-linked WhatsApp sessions/);
  assert.match(help,/not authorized or certified as Meta/);
  assert.match(help,/Graph API uses business assets/);
  assert.match(help,/unofficial apps or websites can create security and account restriction risks/);
  assert.match(help,/cannot promise immunity from restrictions or guaranteed message delivery/);
  assert.match(help,/WhatsApp Business Messaging Policy/);
  assert.match(help,/obtain appropriate opt-in/);
  assert.match(help,/respect opt-out or block requests/);
  assert.match(help,/whatsappbusiness\.com\/policy/);
  assert.match(help,/faq\.whatsapp\.com\/378279804439436/);
  assert.match(help,/www\.postman\.com\/meta\/whatsapp-business-platform/);
  assert.match(help,/href="\/pricing"/);
  assert.match(help,/href="\/api-docs#queue"/);
  assert.match(help,/rel="noopener noreferrer"/);
  assert.ok(!help.includes('guaranteed account safety'));
});
test('No early vendor comparison landing page or false review schema',()=>{
  const routes=read('lib/public-pages.ts');
  const home=read('components/relay-home.tsx');
  assert.ok(!routes.includes('/compare/'));
  assert.ok(!routes.includes('/vs/'));
  assert.ok(!home.includes('AggregateRating'));
});
