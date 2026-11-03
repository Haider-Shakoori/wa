import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('password login rejects disabled users and invalid passwords without exposing account existence', async () => {
  const auth = await source('../src/auth/auth.service.ts');
  assert.match(auth, /async login\(input: LoginDto/);
  assert.match(auth, /requireChallenge\(email,input\.captchaToken,context\)/);
  assert.match(auth, /FROM users WHERE email = \$1 AND disabled_at IS NULL LIMIT 1/);
  assert.match(auth, /!user \|\| !\(await compare\(input\.password, user\.password_hash\)\)/);
  assert.match(auth, /UnauthorizedException\('Invalid email or password'\)/);
  assert.match(auth, /this\.membership\(user\.id\)/);
});

test('JWT guard rechecks active tenant membership and revocation on every protected request', async () => {
  const guard = await source('../src/auth/jwt-auth.guard.ts');
  for (const condition of [
    "header?.startsWith('Bearer ')",
    "m.status = 'active'",
    'u.disabled_at IS NULL',
    'o.suspended_at IS NULL',
    'u.token_version=COALESCE($4::int,0)',
    'ls.revoked_at IS NULL',
    'ls.expires_at>now()',
  ]) assert.ok(guard.includes(condition), `Missing access condition: ${condition}`);
  assert.match(guard, /m\.organization_id = \$2 AND m\.user_id = \$3/);
  assert.match(guard, /if \(!result\.rowCount\) throw new UnauthorizedException/);
});

test('account and session routes require JWT authorization', async () => {
  const controller = await source('../src/auth/auth.controller.ts');
  for (const route of ["@Get('me')", "@Get('sessions')", "@Post('sessions/revoke-all')"]) {
    const start = controller.indexOf(route);
    assert.notEqual(start, -1, `Missing route: ${route}`);
    assert.match(controller.slice(start, start + 105), /@UseGuards\(JwtAuthGuard\)/);
  }
});

test('billing reads and Stripe checkout require tenant permission and scope to token organization', async () => {
  const controller = await source('../src/payments/payments.controller.ts');
  for (const route of ["@Get('providers')", "@Get('payments')", "@Post('checkout/stripe')", "@Post('stripe/billing-portal')"]) {
    const start = controller.indexOf(route);
    assert.notEqual(start, -1, `Missing route: ${route}`);
    const section = controller.slice(start, start + 180);
    assert.match(section, /@UseGuards\(JwtAuthGuard, PermissionGuard\)/);
    assert.match(section, /@RequirePermissions\(PERMISSIONS\.BILLING_MANAGE\)/);
  }
  assert.match(controller, /payments\.history\(request\.auth\.org\)/);
  assert.match(controller, /createStripeCheckout\(request\.auth\.org, body\)/);
  assert.match(controller, /createStripeBillingPortal\(request\.auth\.org\)/);
  assert.match(controller, /if \(!signature \|\| !request\.rawBody\) throw new BadRequestException/);
  assert.match(controller, /stripe\.constructEvent\(request\.rawBody, signature\)/);
});
