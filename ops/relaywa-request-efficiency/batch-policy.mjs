/** Return a stable, bounded plan for read-only or idempotent worker checks. */
const allowed = new Set(['heartbeat', 'healthScan', 'enqueueWebhooks']);
export function validateBatchChecks(value) {
  if (!value || !Array.isArray(value.checks) || !value.checks.length || value.checks.length > 3)
    throw new Error('invalid batch checks');
  if (new Set(value.checks).size !== value.checks.length || value.checks.some(x => !allowed.has(x)))
    throw new Error('unsupported or duplicate check');
  return value.checks;
}
export async function executeBatchChecks(checks, handlers) {
  const requested = validateBatchChecks({checks});
  const results = {};
  for (const action of requested) {
    // Fail rather than silently omit health/heartbeat work.
    results[action] = await handlers[action]();
  }
  return results;
}
