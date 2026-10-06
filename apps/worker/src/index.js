export const workerIdentity = Object.freeze({
  service: 'wa-worker',
  role: 'session-runtime',
  status: 'foundation',
});

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(workerIdentity));
}
