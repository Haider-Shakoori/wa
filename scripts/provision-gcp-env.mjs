import { readFileSync, writeFileSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

// Execute on the GCE VM after securely copying a 0600 production source
// environment file from the VPS. Never copy this source into Git or artifacts.
// Usage: node scripts/provision-gcp-env.mjs SOURCE_FILE OUTPUT_DIRECTORY
//        [--staging]
const [sourceArg, outputArg, mode] = process.argv.slice(2);
if (!sourceArg || !outputArg || (mode && mode !== '--staging')) {
  console.error('Usage: node provision-gcp-env.mjs SOURCE_FILE OUTPUT_DIR [--staging]');
  process.exit(2);
}
const sourceFile = resolve(sourceArg), targetDir = resolve(outputArg);
if ((statSync(sourceFile).mode & 0o077) !== 0) {
  throw new Error('Source production credentials must be owner-readable only');
}
const source = readFileSync(sourceFile, 'utf8');
const readValue = (env, key) => {
  const m = env.match(new RegExp('^' + key + '=(.*)$', 'm'));
  return m?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
};
const put = (env, key, value) => {
  const lines = env.split(/\r?\n/);
  let seen = false;
  const result = lines.map(line => {
    if (!line.startsWith(key + '=')) return line;
    if (seen) return '# duplicate-key-ignored: ' + key;
    seen = true;
    return key + '=' + value;
  });
  if (!seen) result.push(key + '=' + value);
  return result.join('\n').replace(/\n*$/, '\n');
};
for (const key of ['DATABASE_URL', 'JWT_SECRET', 'WEBHOOK_ENCRYPTION_KEY']) {
  if (!readValue(source, key)) throw new Error('Missing required environment setting: ' + key);
}
const database = new URL(readValue(source, 'DATABASE_URL'));
if (!['postgres:', 'postgresql:'].includes(database.protocol)) {
  throw new Error('VPS database must remain PostgreSQL');
}
// PostgreSQL is reached only over a local Unix-domain socket forwarded through SSH.
database.hostname = 'localhost';
database.port = '5432';
database.searchParams.set('host', '/srv/relaywa/private/pg');
database.searchParams.delete('sslmode');
database.searchParams.delete('sslrootcert');

let api = source;
const apiOverrides = {
  NODE_ENV: 'production',
  DATABASE_URL: database.toString(),
  WORKER_DISPATCH_URL: 'http://127.0.0.1:13002',
  WORKER_DISPATCH_URLS: '{}',
  CORS_ORIGINS: mode === '--staging' ?
    'https://gcp-stage.relaywa.com' : 'https://relaywa.com',
  AUTH_FRONTEND_URL: mode === '--staging' ?
    'https://gcp-stage.relaywa.com' : 'https://relaywa.com',
  GITHUB_CALLBACK_URL: mode === '--staging' ?
    'https://gcp-stage.relaywa.com/api/auth/github/callback' :
    'https://relaywa.com/api/auth/github/callback',
  TRUST_PROXY_HOPS: '1',
  DEMO_PAYMENTS_ENABLED: 'false',
};
const redis = readValue(source, 'REDIS_URL');
if (redis) {
  const redisUrl = new URL(redis);
  if (!['redis:', 'rediss:'].includes(redisUrl.protocol)) {
    throw new Error('Unexpected REDIS_URL scheme');
  }
  redisUrl.protocol = 'redis:';
  redisUrl.hostname = '127.0.0.1';
  redisUrl.port = '16379';
  apiOverrides.REDIS_URL = redisUrl.toString();
}
if (mode === '--staging') Object.assign(apiOverrides, {
  STRIPE_MODE: 'test',
  STRIPE_SECRET_KEY: '',
  STRIPE_LIVE_SECRET_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
  STRIPE_LIVE_WEBHOOK_SECRET: '',
});
for (const [key, value] of Object.entries(apiOverrides)) {
  api = put(api, key, value);
}
const webValues = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_SITE_URL: mode === '--staging' ?
    'https://gcp-stage.relaywa.com' : 'https://relaywa.com',
  NEXT_PUBLIC_API_BASE_URL: '/api',
  WEBSITE_ANALYTICS_API_INTERNAL_URL: mode === '--staging' ?
    'https://gcp-stage.relaywa.com' : 'https://relaywa.com',
};
for (const key of [
  'WEBSITE_ANALYTICS_INGEST_KEY',
  'GA4_REGION_PROXY_SECRET',
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_ID',
]) {
  const val = readValue(source, key);
  if (val && mode !== '--staging') webValues[key] = val;
}
const web = Object.entries(webValues).map(([key, val]) => key + '=' + val).join('\n') + '\n';

mkdirSync(targetDir, { recursive: true, mode: 0o700 });
for (const [file, contents] of [['api.env', api], ['web.env', web]]) {
  const output = join(targetDir, mode === '--staging' ? 'stage-' + file : file);
  if (output === sourceFile) throw new Error('Refusing to overwrite source credentials');
  writeFileSync(output, contents, { mode: 0o600 });
  chmodSync(output, 0o600);
}
console.log('Generated private Google Compute Engine environment files; credentials redacted.');
