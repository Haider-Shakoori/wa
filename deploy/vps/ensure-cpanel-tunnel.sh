#!/usr/bin/env bash
# Persistent, least-exposed outbound tunnel from RelayWA VPS to cPanel.
# Existing PostgreSQL/worker Docker containers are never restarted or modified.
set -Eeuo pipefail
umask 077
ROOT=/home/devagent
KEY="$ROOT/.ssh/relaywa_cpanel_tunnel_ed25519"
HOST=51.81.56.231
USER=relaywa
SOCKET=/home/relaywa/.relaywa-staging/private/pg/.s.PGSQL.5432
LOG="$ROOT/.cache/relaywa-cpanel-tunnel.log"
mkdir -p "$ROOT/.cache"
exec 9>"$ROOT/.cache/relaywa-cpanel-tunnel.lock"
flock -n 9 || exit 0
if [[ ! -f "$KEY" ]]; then echo "Tunnel key missing" >&2; exit 1; fi
PG_IP="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' deploy-postgres-1)"
WORKER_IP="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' deploy-worker-1)"
for ip in "$PG_IP" "$WORKER_IP"; do
  if [[ ! "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Missing private Docker IPv4 address" >&2
    exit 1
  fi
done
existing="$(pgrep -u "$(id -u)" -af 'ssh -fNT .*relaywa_cpanel_tunnel_ed25519' || true)"
if [[ "$existing" == *"$PG_IP:5432"* && "$existing" == *"$WORKER_IP:3002"* ]]; then
  exit 0
fi
# If a container IP changed, replace ONLY our dedicated old tunnel.
pkill -u "$(id -u)" -f '^ssh -fNT .*relaywa_cpanel_tunnel_ed25519' || true
sleep 1
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=12 \
  -i "$KEY" "$USER@$HOST" "rm -f $SOCKET"
ssh -fNT -E "$LOG" -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -o ExitOnForwardFailure=yes -o ConnectTimeout=12 \
  -o ServerAliveInterval=20 -o ServerAliveCountMax=3 \
  -i "$KEY" \
  -R "$SOCKET:$PG_IP:5432" \
  -R "127.0.0.1:13002:$WORKER_IP:3002" \
  "$USER@$HOST"
echo "RelayWA cPanel tunnel established (private PostgreSQL socket, authenticated worker dispatch)."
