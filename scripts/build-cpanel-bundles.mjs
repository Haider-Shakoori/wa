import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Builds two independent CloudLinux/Passenger application directories.
 * Run ONLY after pnpm install + pnpm build. No credentials are bundled.
 */
const root = resolve(import.meta.dirname, '..');
const releaseRoot = join(root, '.cpanel-release');
const api = join(releaseRoot, 'api');
const web = join(releaseRoot, 'web');

rmSync(releaseRoot, { recursive: true, force: true });
mkdirSync(api, { recursive: true });
mkdirSync(web, { recursive: true });

const nestDist = join(root, 'apps', 'api', 'dist');
const nestEntrypoint = join(nestDist, 'main.js');
if (!existsSync(nestEntrypoint)) throw new Error('NestJS dist/main.js missing; run pnpm build first');

// pnpm deploy copies ONLY API production dependencies to a portable directory.
// This keeps @wa/worker (Baileys/Chromium/auth data) out of the cPanel release.
const deployed = spawnSync('pnpm', ['--filter', '@wa/api', 'deploy', '--prod', api], {
  cwd: root, stdio: 'inherit', env: process.env,
});
if (deployed.status !== 0) {
  throw new Error('pnpm API deploy failed; do not ship an incomplete artifact');
}
cpSync(nestDist, join(api, 'dist'), { recursive: true, force: true });
cpSync(join(root, 'apps', 'api', 'passenger.js'), join(api, 'app.js'));
if (!existsSync(join(api, 'node_modules', 'pg'))) {
  throw new Error('API artifact missing PostgreSQL client');
}

const standalone = join(root, 'apps', 'web', '.next', 'standalone');
if (!existsSync(standalone)) throw new Error('Next standalone output missing');
cpSync(standalone, web, { recursive: true, force: true });

const candidates = [
  join(web, 'apps', 'web', 'server.js'),
  join(web, 'server.js'),
];
const serverFile = candidates.find(existsSync);
if (!serverFile) throw new Error('Cannot locate Next standalone server.js');
const appDir = dirname(serverFile);
cpSync(join(root, 'apps', 'web', '.next', 'static'), join(appDir, '.next', 'static'), { recursive: true });
cpSync(join(root, 'apps', 'web', 'public'), join(appDir, 'public'), { recursive: true });
cpSync(join(root, 'apps', 'web', 'passenger.js'), join(appDir, 'app.js'));

// Application root differs between monorepo and standalone Next builds.
// The manifest records the correct cPanel Passenger application root.
const location = serverFile.startsWith(join(web, 'apps', 'web'))
  ? 'apps/web'
  : '.';
writeFileSync(join(releaseRoot, 'MANIFEST.txt'), [
  'RelayWA cPanel staging artifacts',
  'api_app_root=api',
  'api_startup=app.js',
  `web_app_root=web/${location}`,
  'web_startup=app.js',
  'node_version=22',
  'database=remote PostgreSQL on VPS (NOT included)',
  'worker=existing VPS (NOT included)',
  'secrets=NOT included',
  '',
].join('\n'));
console.log('Created independent cPanel API and web deployment roots at', releaseRoot);
