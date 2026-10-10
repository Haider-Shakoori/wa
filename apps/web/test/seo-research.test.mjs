import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../../docs/seo/', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');

// All Batch 01 research CSV fields are quoted; this parser is sufficient for the
// source-controlled research fixtures (including commas or doubled quotes).
function parseCsv(file) {
  const lines = read(file).trimEnd().split(/\r?\n/);
  return lines.map((line) => {
    const fields = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)]
      .map((match) => match[1].replaceAll('""', '"'));
    assert.ok(fields.length > 0, `Missing quoted CSV fields in ${file}`);
    return fields;
  });
}

test('Batch 01 research audit and evidence files are present', () => {
  for (const file of ['README.md', 'technical-audit.md', 'content-positioning.md', 'sources-and-measurement.md']) {
    assert.ok(read(file).length > 150, `Missing substantive ${file}`);
  }
});

test('first-wave market matrix has exactly eight unique countries and no invented metrics', () => {
  const [header, ...rows] = parseCsv('markets.csv');
  assert.equal(rows.length, 8);
  assert.equal(header.length, 12);
  assert.equal(new Set(rows.map((row) => row[1])).size, 8);
  assert.deepEqual(new Set(rows.map((row) => row[1])),
    new Set(['IN', 'BR', 'ID', 'MX', 'CO', 'NG', 'AE', 'PK']));
  for (const row of rows) {
    assert.equal(row.length, header.length);
    assert.equal(row[2], 'P1');
    assert.equal(row[8], 'unknown');
    assert.equal(row[9], 'unknown');
    assert.equal(row[10], 'unknown');
    assert.equal(row[11], 'research hypothesis');
  }
});

test('keyword candidates are mapped to future routes without claiming verified volume', () => {
  const [header, ...rows] = parseCsv('keyword-map.csv');
  assert.equal(header.length, 10);
  assert.ok(rows.length >= 20);
  for (const row of rows) {
    assert.equal(row.length, header.length);
    assert.match(row[5], /^\//);
    assert.match(row[9], /unverified|native SERP check/);
  }
});

test('positioning explicitly forbids mistaken official API claims and invalid es-419 hreflang', () => {
  const claims = read('content-positioning.md');
  assert.match(claims, /not the official Meta WhatsApp Cloud API/);
  assert.match(claims, /es-419.*not.*supported/i);
  assert.match(claims, /opt-out/);
});
