import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read=(p)=>readFile(new URL(p,import.meta.url),'utf8');

test('platform admin page checks backend role before setting token or rendering controls',async()=>{
  const page=await read('../app/platform/page.tsx');
  const guard=await read('../../api/src/auth/platform-admin.guard.ts');
  const controller=await read('../../api/src/platform/platform-admin.controller.ts');

  assert.match(page,/fetch\(API_BASE\+'\/platform\/whoami'/);
  assert.match(page,/response\.status===403/);
  assert.match(page,/router\.replace\('\/dashboard'\)/);
  assert.match(page,/response\.status===401/);
  assert.match(page,/setPlatformAccess\('allowed'\)/);
  assert.match(page,/if\(platformAccess!=='allowed'\)/);
  assert.match(page,/if\(platformAccess==='allowed'\)void refresh\(\)/);
  assert.match(page,/Checking platform administrator access/);
  // Admin layout must be behind the gate (never rendered for initial/unverified state).
  assert.ok(page.indexOf("if(platformAccess!=='allowed')") < page.indexOf('return <div className="app-shell platform-shell">'));
  assert.ok(page.indexOf('setToken(current)') > page.indexOf("response.status===403"));
  assert.match(guard,/is_platform_admin/);
  assert.match(guard,/ForbiddenException\('Platform administrator access required'\)/);
  assert.match(controller,/@UseGuards\(JwtAuthGuard, PlatformAdminGuard\)/);
});

test('valid client login stays intact and platform login redirects to client dashboard',async()=>{
  const login=await read('../app/platform/login/page.tsx');
  const page=await read('../app/platform/page.tsx');
  assert.match(login,/api\('\/platform\/whoami',current\)/);
  assert.match(login,/await api\('\/auth\/me',current\)/);
  assert.match(login,/router\.replace\('\/dashboard'\)/);
  // Failed admin permission should not call logout for a valid tenant token.
  const forbiddenBranch=page.slice(page.indexOf("if(response.status===403)"),page.indexOf("if(response.status===401)"));
  assert.doesNotMatch(forbiddenBranch,/localStorage\.removeItem/);
  assert.match(forbiddenBranch,/router\.replace\('\/dashboard'\)/);
});
