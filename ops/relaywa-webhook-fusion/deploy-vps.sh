#!/usr/bin/env bash
# Guarded VPS rollout of Cloudflare webhook enqueue/claim fusion.
set -euo pipefail
mode="${1:-stage}"
target=/home/devagent/relaywa-worker-update
stage=/tmp/relaywa-webhook-fusion-20261015
backup=/home/devagent/relaywa-backups/webhook-fusion-pre-deploy-20261015.tar.gz
test "$(id -u)" -eq 0
test -s "$target/remote-store.js"
test -s "$target/command-loop.js"
test -s "$stage/base-command-loop.js"
test -s "$stage/command-loop.js"
test -s "$stage/webhook-fusion.js"
test -s "$stage/patch-remote-store.mjs"
if ! cmp -s "$target/command-loop.js" "$stage/base-command-loop.js"; then
  echo "ABORT: production worker command loop changed since review" >&2; exit 3
fi
if [[ -e "$target/webhook-fusion.js" ]]; then
  echo "ABORT: webhook fusion helper exists already" >&2; exit 3
fi
if [[ "$mode" == stage || "$mode" == apply ]]; then
  node --input-type=module - "$target" "$stage" <<'NODE'
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const target=process.argv[2], stage=process.argv[3];
const {patchRemoteStoreWebhook}=await import(pathToFileURL(stage+'/patch-remote-store.mjs'));
const source=await readFile(target+'/remote-store.js','utf8');
if(!source.includes('commandClaimHeartbeatVerified'))throw Error('Prior heartbeat-fusion deployment not present');
const patched=patchRemoteStoreWebhook(source);
await writeFile(stage+'/remote-store.js',patched,{mode:0o644});
NODE
  node --check "$stage/remote-store.js"
  node --check "$stage/command-loop.js"
  node --check "$stage/webhook-fusion.js"
  echo "WEBHOOK_FUSION_VPS_STAGE_OK"
fi
if [[ "$mode" == stage ]]; then exit 0; fi
if [[ "$mode" != apply ]]; then echo "Unknown rollout mode" >&2; exit 3; fi
if [[ -e "$backup" ]]; then echo "ABORT: cannot overwrite production backup" >&2; exit 3; fi
mkdir -p /home/devagent/relaywa-backups
tar -czf "$backup" -C "$target" command-loop.js remote-store.js
rollback(){
  local status=$?
  trap - ERR
  echo "WEBHOOK_FUSION_VPS_ROLLBACK exit=$status"
  tar -xzf "$backup" -C "$target"
  rm -f "$target/webhook-fusion.js"
  docker restart relaywa-edge-worker || true
  exit "$status"
}
trap rollback ERR
install -m 0644 "$stage/command-loop.js" "$target/command-loop.js"
install -m 0644 "$stage/remote-store.js" "$target/remote-store.js"
install -m 0644 "$stage/webhook-fusion.js" "$target/webhook-fusion.js"
docker restart relaywa-edge-worker
sleep 9
test "$(docker inspect -f '{{.State.Running}}' relaywa-edge-worker)" = true
docker exec relaywa-edge-worker node --check /opt/worker/remote-store.js
docker exec relaywa-edge-worker node --check /opt/worker/command-loop.js
docker exec relaywa-edge-worker node --check /opt/worker/webhook-fusion.js
trap - ERR
echo "WEBHOOK_FUSION_VPS_DEPLOYED backup=$backup"
