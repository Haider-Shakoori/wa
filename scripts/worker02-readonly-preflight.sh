#!/usr/bin/env bash
# Read-only VPS preflight for standby Worker 02. Does not deploy or read secrets.
set -euo pipefail
echo '=== Existing RelayWA containers ==='
docker ps --format '{{.Names}} {{.Status}}' | grep -E '^relaywa-' || true
echo '=== Worker 02 must not already exist ==='
if docker ps -a --format '{{.Names}}' | grep -Fxq 'relaywa-worker-02'; then
  echo 'STOP: relaywa-worker-02 already exists; inspect before proceeding' >&2
  exit 1
fi
echo '=== Disk ==='
df -h /
echo '=== Memory ==='
free -m
echo '=== Standby compose syntax ==='
if [[ -n "${WORKER_02_ENV_FILE:-}" && -f "$WORKER_02_ENV_FILE" ]]; then
  docker compose -f docker-compose.worker02-standby.yml config --quiet
else
  echo 'SKIP: dedicated worker environment file has not been provisioned'
fi
echo 'PREFLIGHT COMPLETE: no containers or database were modified'
