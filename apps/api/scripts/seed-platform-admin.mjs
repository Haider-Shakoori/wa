import pg from 'pg';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const production = process.env.NODE_ENV === 'production';
const email = (process.env.RELAYWA_ADMIN_EMAIL || (!production ? 'admin@relaywa.local' : '')).trim().toLowerCase();
const password = process.env.RELAYWA_ADMIN_PASSWORD || (!production ? 'ChangeMe123!' : '');
const name = (process.env.RELAYWA_ADMIN_NAME || 'relayWA Administrator').trim();
const organizationName = (process.env.RELAYWA_ADMIN_ORG || 'relayWA Platform').trim();

if (!email || !password) {
  throw new Error('RELAYWA_ADMIN_EMAIL and RELAYWA_ADMIN_PASSWORD are required in production');
}
if (password.length < 12) {
  throw new Error('RELAYWA_ADMIN_PASSWORD must be at least 12 characters');
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  await client.query('BEGIN');

  let user = (await client.query(
    'SELECT id, email FROM users WHERE email = $1 LIMIT 1',
    [email],
  )).rows[0];

  if (!user) {
    const userId = randomUUID();
    const passwordHash = await hash(password, 12);
    user = (await client.query(
      `INSERT INTO users (id, email, name, password_hash, is_platform_admin)
       VALUES ($1,$2,$3,$4,true)
       RETURNING id, email`,
      [userId, email, name, passwordHash],
    )).rows[0];
  } else {
    await client.query(
      'UPDATE users SET is_platform_admin = true, updated_at = now() WHERE id = $1',
      [user.id],
    );
  }

  let membership = (await client.query(
    `SELECT m.id, m.organization_id
     FROM organization_memberships m
     WHERE m.user_id = $1 AND m.status = 'active'
     ORDER BY m.created_at ASC
     LIMIT 1`,
    [user.id],
  )).rows[0];

  if (!membership) {
    const organizationId = randomUUID();
    const membershipId = randomUUID();
    const slugBase = organizationName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'relaywa-platform';
    await client.query(
      'INSERT INTO organizations (id, name, slug) VALUES ($1,$2,$3)',
      [organizationId, organizationName, `${slugBase}-${organizationId.slice(0,8)}`],
    );
    await client.query(
      `INSERT INTO organization_memberships
       (id, organization_id, user_id, role, status)
       VALUES ($1,$2,$3,'owner','active')`,
      [membershipId, organizationId, user.id],
    );
    await client.query(
      `INSERT INTO organization_subscriptions
       (organization_id, plan_code, status, current_period_start, current_period_end, trial_ends_at)
       VALUES ($1,'trial','trialing',now(),now() + interval '7 days',now() + interval '7 days')
       ON CONFLICT (organization_id) DO NOTHING`,
      [organizationId],
    );
    membership = { id: membershipId, organization_id: organizationId };
  }

  await client.query('COMMIT');

  console.log(JSON.stringify({
    ok: true,
    email,
    userId: user.id,
    organizationId: membership.organization_id,
    platformAdmin: true,
    note: production
      ? 'Platform admin seeded from environment variables.'
      : 'Development defaults were used only because NODE_ENV is not production.',
  }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
