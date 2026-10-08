import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=path=>readFile(new URL(path,import.meta.url),'utf8');

test('only a super-admin can grant existing RelayWA account administrator privileges',async()=>{
 const [controller,dto,service]=await Promise.all([
  load('../src/platform/platform-admin.controller.ts'),
  load('../src/platform/platform-admin.dto.ts'),
  load('../src/platform/platform-admin.service.ts'),
 ]);
 assert.match(controller, /@Post\('administrators'\)\s+@PlatformRoles\('super_admin'\)/);
 assert.match(controller, /return this\.platform\.addAdministrator\(body, request\.auth\.sub\)/);
 assert.match(dto, /class AddPlatformAdministratorDto/);
 assert.match(dto, /@IsEmail\(\)/);
 assert.match(dto, /@MinLength\(8\)/);
 const block=service.slice(service.indexOf('async addAdministrator('),service.indexOf('async updateAdminRole('));
 assert.match(block, /this\.db\.transaction\(async client =>/);
 assert.match(block, /FROM users WHERE lower\(email\)= \$1 AND disabled_at IS NULL FOR UPDATE/);
 assert.match(block, /account\.is_platform_admin/);
 assert.match(block, /m\.status='active' AND o\.suspended_at IS NULL/);
 assert.match(block, /platform_role=\$2/);
 assert.match(block, /token_version=token_version\+1/);
 assert.match(block, /user_login_sessions SET revoked_at=now\(\)/);
 assert.match(block, /platform\.admin\.added/);
 assert.doesNotMatch(block, /password_hash\s*=|INSERT INTO users|INSERT INTO organizations|tempPassword/);
});

test('administrator additions do not affect subscription or WhatsApp data',async()=>{
 const service=await load('../src/platform/platform-admin.service.ts');
 const block=service.slice(service.indexOf('async addAdministrator('),service.indexOf('async updateAdminRole('));
 assert.doesNotMatch(block, /UPDATE organization_subscriptions|DELETE FROM whatsapp_sessions|UPDATE whatsapp_sessions/);
});
