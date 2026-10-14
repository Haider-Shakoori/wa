// Fail open to normal polling whenever worker session state cannot be inspected.
export function hasActiveSessions(sessions) {
  const engines = sessions?.engines;
  if (!(engines instanceof Map)) return true;
  for (const engine of engines.values()) {
    const registry = engine?.sockets ?? engine?.clients;
    if (!(registry instanceof Map)) return true;
    if (registry.size > 0) return true;
  }
  return false;
}

export function boundedInterval(value, fallback, floor = 15000, ceiling = 300000) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(ceiling, Math.max(floor, Math.trunc(parsed)));
}
