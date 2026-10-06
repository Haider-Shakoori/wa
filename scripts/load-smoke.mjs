const base = process.env.LOAD_BASE_URL;
if (!base) throw new Error('LOAD_BASE_URL is required');

const requests = Number(process.env.LOAD_REQUESTS ?? 200);
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 20);
let index = 0;
let failures = 0;
const latencies = [];

async function worker() {
  while (true) {
    const current = index++;
    if (current >= requests) return;
    const started = performance.now();
    try {
      const response = await fetch(`${base.replace(/\/$/, '')}/api/health`);
      if (!response.ok) failures += 1;
    } catch {
      failures += 1;
    } finally {
      latencies.push(performance.now() - started);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
latencies.sort((a,b)=>a-b);
const p95 = latencies[Math.max(0, Math.floor(latencies.length * .95) - 1)] ?? 0;
const result = { requests, concurrency, failures, p95Ms: Math.round(p95) };
console.log(JSON.stringify(result, null, 2));
if (failures > 0) process.exitCode = 1;
