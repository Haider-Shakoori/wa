import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('pricing answers remain server-rendered and independently crawlable', () => {
  const page = read('app/pricing/page.tsx');
  const client = read('components/relay-home.tsx');
  assert.match(page, /marketingPageMetadata\('\/pricing'\)/);
  assert.match(page, /Understand your RelayWA subscription/);
  assert.match(page, /What is included in the free trial\?/);
  assert.match(page, /Are messages billed separately\?/);
  assert.match(page, /Is RelayWA the official WhatsApp Cloud API\?/);
  assert.match(page, /not Meta's official Cloud API/);
  assert.match(page, /href="\/register"/);
  assert.match(page, /href="\/guides\/whatsapp-web-vs-cloud-api"/);
  assert.match(client, /api<Plan\[]>\('\/public\/plans'\)/);
  assert.match(client, /<PlanCards plans=\{plans\} annual=\{annual\}/);
});

test('pricing headings remain unambiguous for existing browser tests', () => {
  const page = read('app/pricing/page.tsx');
  const client = read('components/relay-home.tsx');
  assert.match(client, /<h1>WhatsApp API pricing<\/h1>/);
  assert.doesNotMatch(page, /<h[1-6][^>]*>[^<]*WhatsApp API pricing[^<]*<\/h[1-6]>/);
});
