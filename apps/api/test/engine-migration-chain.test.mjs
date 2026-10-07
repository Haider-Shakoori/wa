import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('production migration chain includes engine migrations', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.migrate, /019_messaging_engine_settings\.sql/);
  assert.match(pkg.scripts.migrate, /020_session_engine_handover\.sql/);
  assert.ok(
    pkg.scripts.migrate.indexOf('019_messaging_engine_settings.sql')
      < pkg.scripts.migrate.indexOf('020_session_engine_handover.sql'),
  );
});
