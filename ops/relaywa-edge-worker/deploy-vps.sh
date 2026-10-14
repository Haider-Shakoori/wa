#!/usr/bin/env bash
# Deploy a reviewed adaptive idle poll overlay to the existing VPS bind mount.
# Do not replace the relaywa-edge-worker container image or database bindings.
set -euo pipefail
target=/home/devagent/relaywa-worker-update
stage=/tmp/relaywa-idle-4ec32e0
backup=/home/devagent/relaywa-backups/edge-worker-pre-idle-20261014.tar.gz

test "$(id -u)" -eq 0
test -s "$backup"
test -f "$target/webhook-delivery.js"
test -s "$stage/base-command-loop.js"
test -s "$stage/base-outbound-poll.js"
test -s "$stage/command-loop.js"
test -s "$stage/outbound-poll.js"
test -s "$stage/adaptive-poll.js"

# Require live source files to match the independently captured production baseline.
python3 - "$target" "$stage" <<'PY'
from pathlib import Path
import sys
target, stage = map(Path, sys.argv[1:])
for name in ['command-loop.js','outbound-poll.js']:
    live=(target/name).read_bytes().replace(b'\r\n', b'\n')
    original=(stage/('base-'+name)).read_bytes()
    if live != original: raise SystemExit('ABORT: production '+name+' changed since baseline')
print('Production source matches reviewed baseline')
PY

for name in adaptive-poll.js command-loop.js outbound-poll.js; do
  node --check --input-type=module < "$stage/$name"
done

rolled_back=0
rollback() {
  local err=$?
  trap - ERR
  if [ "$rolled_back" -eq 0 ]; then
    echo "Worker rollout failed ($err); restoring original two files"
    tar -xzf "$backup" -C "$target"
    rm -f "$target/adaptive-poll.js"
    docker restart relaywa-edge-worker || true
    rolled_back=1
  fi
  exit "$err"
}
trap rollback ERR

install -m 0644 "$stage/adaptive-poll.js" "$target/adaptive-poll.js"
install -m 0644 "$stage/command-loop.js" "$target/command-loop.js"
install -m 0644 "$stage/outbound-poll.js" "$target/outbound-poll.js"

docker restart relaywa-edge-worker
sleep 5
test "$(docker inspect -f '{{.State.Running}}' relaywa-edge-worker)" = true
docker exec relaywa-edge-worker node --input-type=module -e "import('/opt/worker/adaptive-poll.js').then(x=>{if(!x.hasActiveSessions||!x.boundedInterval)process.exit(3)})"
trap - ERR
echo "RELAYWA_IDLE_POLL_DEPLOYED"
