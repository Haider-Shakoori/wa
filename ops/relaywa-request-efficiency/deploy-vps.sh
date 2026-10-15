#!/usr/bin/env bash
# Guarded VPS rollout of heartbeat fusion; no WhatsApp auth or customer data changes.
set -euo pipefail
mode="${1:-stage}"
target=/home/devagent/relaywa-worker-update
stage=/tmp/relaywa-heartbeat-fusion
backups=/home/devagent/relaywa-backups
backup="${backups}/heartbeat-fusion-pre-deploy-20261015.tar.gz"
test "$(id -u)" -eq 0
test -f "$target/command-loop.js"
test -f "$target/remote-store.js"
test -s "$stage/base-command-loop.js"
test -s "$stage/command-loop.js"
test -s "$stage/patch-remote-store.mjs"
mkdir -p "$backups"
if ! cmp -s "$target/command-loop.js" "$stage/base-command-loop.js"; then
  echo "ABORT: production command loop differs from reviewed baseline" >&2
  exit 3
fi
if [[ "$mode" == stage || "$mode" == apply ]]; then
  node --input-type=module - "$target" "$stage" <<'NODE'
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const target=process.argv[2],stage=process.argv[3];
const {patchRemoteStore}=await import(pathToFileURL(stage+'/patch-remote-store.mjs'));
const source=await readFile(target+'/remote-store.js','utf8');
const patched=patchRemoteStore(source);
await writeFile(stage+'/remote-store.js',patched,{mode:0o644});
NODE
  node --check "$stage/remote-store.js"
  node --check "$stage/command-loop.js"
  echo "STAGING_VALIDATED"
fi
if [[ "$mode" == stage ]]; then exit 0; fi
if [[ "$mode" != apply ]]; then echo "Unsupported mode $mode" >&2; exit 3; fi
if [[ -e "$backup" ]]; then echo "ABORT: backup name already in use" >&2; exit 3; fi
tar -czf "$backup" -C "$target" command-loop.js remote-store.js
restore() {
  local exit_code=$?
  trap - ERR
  echo "HEARTBEAT_FUSION_ROLLBACK exit=$exit_code"
  tar -xzf "$backup" -C "$target"
  docker restart relaywa-edge-worker || true
  exit "$exit_code"
}
trap restore ERR
install -m 0644 "$stage/command-loop.js" "$target/command-loop.js"
install -m 0644 "$stage/remote-store.js" "$target/remote-store.js"
docker restart relaywa-edge-worker
sleep 8
test "$(docker inspect -f '{{.State.Running}}' relaywa-edge-worker)" = true
docker exec relaywa-edge-worker node --check /opt/worker/command-loop.js
docker exec relaywa-edge-worker node --check /opt/worker/remote-store.js
trap - ERR
echo "HEARTBEAT_FUSION_WORKER_APPLIED_WITH_ROLLBACK backup=$backup"
