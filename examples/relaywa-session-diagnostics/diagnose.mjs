/**
 * Non-destructive, read-only diagnostic of a RelayWA QR-linked session.
 * Run with Node.js 20+ from a trusted server.
 *
 * RELAYWA_API_KEY=<server-only-key-with-sessions.read>
 * RELAYWA_SESSION_ID=<existing-session-id>
 * node examples/relaywa-session-diagnostics/diagnose.mjs
 *
 * NEVER print qr, dataUrl, access tokens or bearer keys.
 * A successful connect/restart command means QUEUED, not connected.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const SESSION_STATES = Object.freeze([
  'pending','need_scan','connecting','connected','disconnected',
  'reconnecting','logged_out','expired','error',
]);

export function interpretSession(session, qr) {
  if (!session || typeof session !== 'object') throw new Error('Missing session response');
  const state=session.status;
  if (!SESSION_STATES.includes(state)) {
    return {status:'unrecognized',qrAvailable:false,
      finding:'Unrecognized session state. Verify the current API contract; do not automate destructive actions.',
      next:'Inspect the authenticated session details and event logs.'};
  }
  const available=qr?.available===true && qr?.status===state;
  const guidance={
    pending:['Session created, connection has not started.',
      'Use the authorized workspace Connect action, then poll status; command acceptance only queues the operation.'],
    need_scan:[available
      ? 'QR is available for the authorized account owner to scan.'
      : 'Pairing is required, but a fresh QR is not currently available.',
      available
      ? 'Show the QR securely to the account owner in RelayWA, then check session status.'
      : 'Wait for a new QR/worker event and check its expiry; do not repeatedly create sessions or log QR data.'],
    connecting:['A pairing/connection attempt is in progress.',
      'Wait for state changes and inspect /events or /logs if it stalls; do not force logout.'],
    connected:['Session is connected.',
      'Do not restart solely because a previous QR expired. Investigate send errors separately.'],
    disconnected:['Current session is disconnected.',
      'Inspect last connection state and worker diagnostics; consider an operator-initiated restart without logout after checking connectivity.'],
    reconnecting:['Runtime is attempting to restore an existing session.',
      'Allow reconnection time and inspect worker/network health; avoid automatic logout or repeated restart loops.'],
    logged_out:['Account authentication has ended.',
      'Ask the authorized account owner to re-pair by scanning a newly issued QR if available.'],
    expired:['Session is expired.',
      'Check account/subscription state and logs; re-pair only if the runtime actually requires it.'],
    error:['The session reports an error.',
      'Inspect session event logs and worker health; escalate instead of blindly reconnecting or logging out.'],
  };
  return {status:state,qrAvailable:available,
    finding:guidance[state][0],next:guidance[state][1]};
}

export function createSessionDiagnostics({
  apiBase='https://relaywa.com/api',key,fetchImpl=fetch,
}){
  if(!key || typeof key!=='string')throw new Error('Set a server-side API key with sessions.read permission');
  if(!/^https:\/\/[^/?#]+(?:\/[^?#]*)?$/.test(apiBase))throw new Error('Use an absolute HTTPS RelayWA API URL');
  const base=apiBase.replace(/\/$/,'');
  async function request(path){
    const response=await fetchImpl(base+path,{
      method:'GET',
      headers:{Authorization:'Bearer '+key,Accept:'application/json'},
      signal:AbortSignal.timeout(15000),
    });
    if(!response.ok)throw new Error('RelayWA read failed: HTTP '+response.status+
      '. Check sessions.read scope, subscription and session visibility.');
    return await response.json();
  }
  return async function diagnose(sessionId){
    if(!/^[0-9a-f-]{36}$/i.test(sessionId))throw new Error('Expected an existing session UUID');
    const path='/whatsapp-sessions/'+encodeURIComponent(sessionId);
    const session=await request(path);
    // The QR endpoint may return sensitive "qr" and "dataUrl". Only retain its
    // metadata; never return or print the raw QR outside an authorized UI.
    const qr=await request(path+'/qrcode');
    return interpretSession(session, {status:qr.status,available:qr.available});
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const key=process.env.RELAYWA_API_KEY;
  const sessionId=process.env.RELAYWA_SESSION_ID;
  if(!key||!sessionId)throw new Error('Set RELAYWA_API_KEY and RELAYWA_SESSION_ID');
  const diagnose=createSessionDiagnostics({key});
  diagnose(sessionId).then(result=>console.log(JSON.stringify(result,null,2)))
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}