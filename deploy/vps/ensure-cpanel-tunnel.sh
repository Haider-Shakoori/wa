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
# Only inspect real SSH processes. pgrep -af can match the watchdog's own
# shell command and incorrectly declare a missing tunnel healthy.
existing="$(ps -u "$(id -u)" -o comm=,args= | awk '$1 == "ssh" && index($0, "relaywa_cpanel_tunnel_ed25519") > 0 { print }')"
if [[ "$existing" == *"$PG_IP:5432"* && "$existing" == *"$WORKER_IP:3002"* ]]; then
  exit 0
fi
# Never interrupt an established SSH connection from this check. If Docker
# networking changed, fail visibly and require a coordinated switch.
if [[ -n "$existing" ]]; then
  echo 'Tunnel exists but target container addresses have changed; refusing automatic interruption' >&2
  exit 2
fi
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
