import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/worker-bridge/enterprise-worker-authorization.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
const load = new Function('module', 'exports', 'require', compiled);
load(module, module.exports, require);
const { authorizeEnterpriseWorker } = module.exports;
const token = 'a'.repeat(64);
const digest = createHash('sha256').update(token).digest('hex');
const identity = { worker_id: 'enterprise-org-1', organization_id: 'org-1', token_sha256: digest };
const fakeDb = (rows) => ({
  query: async (sql, params) => {
    assert.match(sql, /ew\.status='ready'/);
    assert.match(sql, /ec\.revoked_at IS NULL/);
    assert.deepEqual(params, ['enterprise-org-1']);
    return { rows };
  },
});

test('enterprise credential authenticates correct worker and organization', async () => {
  assert.deepEqual(await authorizeEnterpriseWorker(fakeDb([identity]), 'Bearer ' + token, 'enterprise-org-1'), {
    workerId: 'enterprise-org-1', organizationId: 'org-1',
  });
});
test('enterprise credential rejects wrong token and missing bearer', async () => {
  await assert.rejects(authorizeEnterpriseWorker(fakeDb([identity]), 'Bearer ' + 'b'.repeat(64), 'enterprise-org-1'));
  await assert.rejects(authorizeEnterpriseWorker(fakeDb([identity]), token, 'enterprise-org-1'));
});
test('enterprise credential rejects missing/revoked worker and malformed ID', async () => {
  await assert.rejects(authorizeEnterpriseWorker(fakeDb([]), 'Bearer ' + token, 'enterprise-org-1'));
  await assert.rejects(authorizeEnterpriseWorker(fakeDb([]), 'Bearer ' + token, 'shared-1'));
});
