// Narrow edit to the VPS RemoteStore, preserving all original API requests
// unless the Cloudflare API explicitly confirms a combined command heartbeat.
export function patchRemoteStore(original) {
  let source = String(original);
  const constructorAnchor = '    this.cooldownUntil = 0;';
  const closeAnchor = '  async close() { /* no persistent connections */ }';
  const returnAnchor = '        return payload;';
  for (const [name, anchor] of Object.entries({constructorAnchor,closeAnchor,returnAnchor})) {
    if (source.split(anchor).length !== 2) throw Error('Unexpected RemoteStore layout: '+name);
  }
  source = source.replace(constructorAnchor,
    constructorAnchor + '\n    this.commandHeartbeatConfirmedAt = 0;');
  source = source.replace(closeAnchor,
    `  commandClaimHeartbeatVerified() {
    return this.commandHeartbeatConfirmedAt > 0 &&
      Date.now() - this.commandHeartbeatConfirmedAt <= 12000;
  }

` + closeAnchor);
  source = source.replace(returnAnchor,
    `        if (path === '/commands/claim') {
          this.commandHeartbeatConfirmedAt =
            response.headers.get('x-relaywa-heartbeat-combined') === '1'
              ? Date.now() : 0;
        }
` + returnAnchor);
  return source;
}
