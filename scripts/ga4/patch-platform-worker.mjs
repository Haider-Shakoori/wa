import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Operates on the recovered, deployed platform Worker bundle in a temporary
// GitHub Actions workspace. Does NOT upload/deploy anything to Cloudflare.
export function patchPlatformWorker(source, reportModule) {
  if (typeof source !== 'string' || typeof reportModule !== 'string') {
    throw new TypeError('Worker source and report module must be strings');
  }
  if (source.includes('GA4_SERVICE_ACCOUNT_JSON') || source.includes('relaywaGa4ReportData')) {
    throw new Error('Platform bundle already contains a GA4 integration; manual review required');
  }
  const matcher = /(?:async\s+)?function googleAnalytics\(env, url\) \{[\s\S]*?\n\}/g;
  const fragments = [...source.matchAll(matcher)];
  if (fragments.length !== 1) throw new Error('Expected exactly one platform Google Analytics handler');
  if (!fragments[0][0].includes('not_configured') || !fragments[0][0].includes('558119248')) {
    throw new Error('GA4 handler is no longer the expected placeholder; manual review required');
  }
  if (!source.includes('googleAnalytics(e, r.url)')) {
    throw new Error('Expected authenticated platform route dispatch not found; manual review required');
  }
  if (!reportModule.includes('export async function relaywaGa4ReportData(env, url)') ||
      !reportModule.includes('analytics.readonly')) {
    throw new Error('Unexpected or invalid GA4 reporting module');
  }
  // The original platform router remains byte-for-byte unchanged outside this
  // placeholder replacement and one appended module. This preserves existing
  // authentication and RBAC checks.
  const replacement = [
    'async function googleAnalytics(env, url) {',
    '  return json(await relaywaGa4ReportData(env, url));',
    '}'
  ].join('\n');
  const inlineHelper = reportModule.replace(/^export\s+/gm, '');
  return source.replace(fragments[0][0], replacement) +
    '\n\n// RelayWA GA4 Worker reporting — prepared from audited GitHub source\n' + inlineHelper;
}

async function main() {
  const [sourcePath, modulePath, outputPath] = process.argv.slice(2);
  if (!sourcePath || !modulePath || !outputPath) {
    throw new Error('Usage: node patch-platform-worker.mjs <existing-index.js> <ga4-reporting.mjs> <output.js>');
  }
  const source = await readFile(sourcePath, 'utf8');
  const module = await readFile(modulePath, 'utf8');
  const candidate = patchPlatformWorker(source, module);
  await writeFile(outputPath, candidate, { mode: 0o600 });
  console.log('Cloudflare platform GA4 deployment candidate generated locally; not uploaded.');
  console.log('Existing admin routes preserved; GA4 placeholder replaced exactly once.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('Unable to build safe GA4 patch candidate. No deployment performed.');
    process.exitCode = 1;
  });
}
