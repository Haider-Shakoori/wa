import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, readlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { rebaseStandaloneLinks } from '../../../scripts/rebase-standalone-links.mjs';

test('rebase Next.js pnpm absolute links to portable archive-relative links', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'relaywa-standalone-'));
  try {
    const source = join(tmp, 'runner', 'standalone');
    const release = join(tmp, 'release', 'web');
    const nested = 'node_modules/.pnpm/next@16/node_modules/next';
    mkdirSync(join(source, nested), { recursive: true });
    mkdirSync(join(release, nested), { recursive: true });
    writeFileSync(join(release, nested, 'package.json'), '{}');
    mkdirSync(join(release, 'apps/web/node_modules'), { recursive: true });
    const link = join(release, 'apps/web/node_modules/next');
    symlinkSync(join(source, nested), link);
    assert.equal(rebaseStandaloneLinks(source, release), 1);
    assert.equal(isAbsolute(readlinkSync(link)), false);
    assert.equal(existsSync(join(link, 'package.json')), true);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('reject absolute links to dependencies outside bundled tree', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'relaywa-standalone-'));
  try {
    const source = join(tmp, 'source'), release = join(tmp, 'release');
    mkdirSync(source); mkdirSync(release);
    symlinkSync('/outside/workspace/node_modules/next', join(release, 'next'));
    assert.throws(() => rebaseStandaloneLinks(source, release), /outside Next build/);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
