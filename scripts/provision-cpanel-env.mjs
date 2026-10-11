import { readFileSync, writeFileSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Run on the destination host only. Never run against or overwrite the VPS source .env.
const [sourceArg, destinationArg] = process.argv.slice(2);
if (!sourceArg || !destinationArg) {
  console.error('Usage: node provision-cpanel-env.mjs <private-production-env-copy> <private-output-directory>');
  process.exit(2);
}
const sourcePath = resolve(sourceArg);
const destination = resolve(destinationArg);
if ((statSync(sourcePath).mode & 0o077) !== 0) {
  throw new Error('Source environment file must be owner-only');
}
let source = readFileSync(sourcePath, 'utf8');
const readValue = (name) => {
  const match = source.match(new RegExp('^' + name + '=(.*)$', 'm'));
  return match?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
};
for (const name of ['DATABASE_URL', 'JWT_SECRET', 'WEBHOOK_ENCRYPTION_KEY', 'RELAYWA_ADMIN_EMAIL', 'RELAYWA_ADMIN_PASSWORD']) {
  if (!readValue(name)) throw new Error('Required production setting is missing: ' + name);
}
const databaseUrl = new URL(readValue('DATABASE_URL'));
if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) throw new Error('Expected PostgreSQL DATABASE_URL');
databaseUrl.hostname = 'localhost';
databaseUrl.port = '5432';
databaseUrl.searchParams.set('host', '/home/relaywa/.relaywa-staging/private/pg');
databaseUrl.searchParams.delete('sslmode');
databaseUrl.searchParams.delete('sslrootcert');
function put(env, key, value) {
  const lines = env.split(/\r?\n/);
  let seen = false;
  const updated = lines.map((line) => {
    if (!line.startsWith(key + '=')) return line;
    if (seen) return '# superseded duplicate ' + key;
    seen = true;
    return key + '=' + value;
  });
  if (!seen) updated.push(key + '=' + value);
  return updated.join('\n').replace(/\n*$/, '\n');
}
const staging = {
  NODE_ENV: 'production',
  DATABASE_URL: databaseUrl.toString(),
  WORKER_DISPATCH_URL: 'http://127.0.0.1:13002',
  WORKER_DISPATCH_URLS: '{}',
  CORS_ORIGINS: 'https://staging.relaywa.com',
  AUTH_FRONTEND_URL: 'https://staging.relaywa.com',
  GITHUB_CALLBACK_URL: 'https://staging.relaywa.com/api/auth/github/callback',
  TRUST_PROXY_HOPS: '1',
  STRIPE_MODE: 'test',
  STRIPE_SECRET_KEY: '',
  STRIPE_LIVE_SECRET_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
  STRIPE_LIVE_WEBHOOK_SECRET: '',
  DEMO_PAYMENTS_ENABLED: 'false',
  STRIPE_PORTAL_RETURN_URL: 'https://staging.relaywa.com/subscription',
  STRIPE_SUCCESS_URL: 'https://staging.relaywa.com/subscription?checkout=success',
  STRIPE_CANCEL_URL: 'https://staging.relaywa.com/subscription?checkout=cancel',
};
for (const [key,value] of Object.entries(staging)) source = put(source, key, value);
const web = [
  'NODE_ENV=production',
  'NEXT_PUBLIC_SITE_URL=https://staging.relaywa.com',
  'NEXT_PUBLIC_API_BASE_URL=/api',
  'WEBSITE_ANALYTICS_API_INTERNAL_URL=https://api-staging.relaywa.com',
  'GA4_REGION_IP_LOOKUP_ENABLED=false',
].join('\n') + '\n';
mkdirSync(destination, { recursive: true, mode: 0o700 });
for (const [name,content] of [['api.env',source],['web.env',web]]) {
  const file = join(destination,name);
  if (file === sourcePath) throw new Error('Refusing to overwrite source');
  writeFileSync(file,content,{mode:0o600});
  chmodSync(file,0o600);
}
console.log('Wrote staging API/web environment files (credentials redacted).');

if (process.argv.includes('--include-production')) {
  // Production keeps the source billing/OAuth/SMTP secrets, but only remaps
  // transport endpoints and same-origin callbacks. It never writes the source.
  let original = readFileSync(sourcePath, 'utf8');
  const production = {
    NODE_ENV: 'production',
    DATABASE_URL: databaseUrl.toString(),
    WORKER_DISPATCH_URL: 'http://127.0.0.1:13002',
    WORKER_DISPATCH_URLS: '{}',
    CORS_ORIGINS: 'https://relaywa.com',
    AUTH_FRONTEND_URL: 'https://relaywa.com',
    GITHUB_CALLBACK_URL: 'https://relaywa.com/api/auth/github/callback',
    TRUST_PROXY_HOPS: '1',
    STRIPE_PORTAL_RETURN_URL: 'https://relaywa.com/subscription',
    STRIPE_SUCCESS_URL: 'https://relaywa.com/subscription?checkout=success',
    STRIPE_CANCEL_URL: 'https://relaywa.com/subscription?checkout=cancel',
    DEMO_PAYMENTS_ENABLED: 'false',
  };
  for (const [key, value] of Object.entries(production)) original = put(original, key, value);
  const prodWeb = [
    'NODE_ENV=production',
    'NEXT_PUBLIC_SITE_URL=https://relaywa.com',
    'NEXT_PUBLIC_API_BASE_URL=/api',
    'WEBSITE_ANALYTICS_API_INTERNAL_URL=https://relaywa.com',
    // Geo attribution cannot be trusted until the new cPanel proxy chain is audited.
    'GA4_REGION_IP_LOOKUP_ENABLED=false',
  ];
  for (const key of ['WEBSITE_ANALYTICS_INGEST_KEY', 'GA4_REGION_PROXY_SECRET', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID']) {
    const row = original.match(new RegExp('^' + key + '=(.*)$', 'm'));
    if (row?.[1]) prodWeb.push(key + '=' + row[1]);
  }
  for (const [name, content] of [
    ['api-production.env', original],
    ['web-production.env', prodWeb.join('\n') + '\n'],
  ]) {
    const file = join(destination, name);
    if (file === sourcePath) throw new Error('Refusing to overwrite source');
    writeFileSync(file, content, { mode: 0o600 });
    chmodSync(file, 0o600);
  }
  console.log('Wrote separate private production candidate configuration (secrets redacted).');
}
