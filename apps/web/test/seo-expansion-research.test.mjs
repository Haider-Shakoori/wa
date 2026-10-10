import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../../docs/seo/', import.meta.url);
const read = (file) => readFileSync(new URL(file, root), 'utf8');
function rows(file) {
  return read(file).trimEnd().split(/\r?\n/).map((line) => {
    const parsed = [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((m) => m[1].replaceAll('""', '"'));
    assert.ok(parsed.length, `CSV must be quoted in ${file}`);
    return parsed;
  });
}

test('five-market expansion has valid unique country identifiers and source links', () => {
  const [header, ...data] = rows('expansion-markets.csv');
  assert.equal(header.length, 13);
  assert.equal(data.length, 5);
  assert.deepEqual(new Set(data.map((r) => r[1])), new Set(['SA', 'ZA', 'ES', 'DE', 'GB']));
  for (const r of data) {
    assert.equal(r.length, header.length);
    assert.match(r[6], /^https:\/\/datareportal\.com\/reports\/digital-2026-/);
    assert.match(r[8], /^https:\/\//);
    assert.ok(Number(r[5]) > 0);
    assert.equal(r[9], 'unknown');
    assert.equal(r[10], 'unknown');
    assert.equal(r[11], 'unknown');
    assert.match(r[2], /^wave[23]_/);
  }
});

test('25 expansion keywords have substantive target intent but no invented demand', () => {
  const [header, ...data] = rows('expansion-keywords.csv');
  assert.equal(header.length, 10);
  assert.equal(data.length, 25);
  const counts = new Map();
  for (const r of data) {
    assert.equal(r.length, header.length);
    assert.match(r[5], /^\//);
    assert.equal(r[7], 'unknown');
    assert.equal(r[8], 'unknown');
    assert.match(r[9], /unverified/);
    assert.ok(r[2].length > 7);
    assert.ok(r[3].length > 4);
    counts.set(r[0], (counts.get(r[0]) ?? 0) + 1);
  }
  assert.deepEqual([...counts.entries()].sort(), [['DE', 5], ['ES', 5], ['GB', 5], ['SA', 5], ['ZA', 5]]);
});

test('market assessment preserves original wave one and distinguishes API types', () => {
  const memo = read('expansion-five-markets.md');
  assert.match(memo, /Original eight Wave-1 markets remain unchanged/);
  assert.match(memo, /not Meta's official WhatsApp Cloud API/);
  assert.match(memo, /not.*WhatsApp user counts/i);
  assert.match(memo, /only for real published pages/);
});
