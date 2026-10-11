#!/usr/bin/env bash
# Execute on the EXISTING VPS, as devagent. The VPS remains the data/worker host.
# An SSH reverse tunnel terminates on the dedicated Google Compute Engine VM.
# No PostgreSQL/Redis/WhatsApp worker ports need public exposure.
set -Eeuo pipefail
umask 077
: "${RELAYWA_GCE_SSH_HOST:?Set the dedicated GCE VM IP/hostname}"
: "${RELAYWA_GCE_SSH_KEY:?Set an authorized, dedicated private SSH key path}"
: "${RELAYWA_GCE_SSH_USER:=relaywa}"
LOG_DIR="${HOME}/.cache"
mkdir -p "$LOG_DIR"
exec 9>"$LOG_DIR/relaywa-gce-tunnel.lock"
flock -n 9 || exit 0
[[ -r "$RELAYWA_GCE_SSH_KEY" ]] || { echo "SSH key missing" >&2; exit 1; }

PG_IP="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' deploy-postgres-1)"
REDIS_IP="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' deploy-redis-1)"
WORKER_IP="$(docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' deploy-worker-1)"
for ip in "$PG_IP" "$REDIS_IP" "$WORKER_IP"; do
  [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
    echo "Cannot determine the private Docker IPv4 address" >&2; exit 1;
  }
done

SOCKET=/srv/relaywa/private/pg/.s.PGSQL.5432
# Check only real SSH processes to avoid matching the watchdog command itself.
keyName="${RELAYWA_GCE_SSH_KEY##*/}"
existing="$(ps -u "$(id -u)" -o comm=,args= |
  awk -v needle="$keyName" '$1=="ssh" && index($0,needle)>0 {print}')"
if [[ "$existing" == *"$PG_IP:5432"* &&
      "$existing" == *"$REDIS_IP:6379"* &&
      "$existing" == *"$WORKER_IP:3002"* ]]; then
  exit 0
fi
if [[ -n "$existing" ]]; then
  echo "Old GCE tunnel has stale container targets; refusing unsafe automatic replacement" >&2
  exit 2
fi

ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=12 \
  -i "$RELAYWA_GCE_SSH_KEY" "$RELAYWA_GCE_SSH_USER@$RELAYWA_GCE_SSH_HOST" \
  "rm -f $SOCKET"
ssh -fNT -E "$LOG_DIR/relaywa-gce-tunnel.log" \
  -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -o ExitOnForwardFailure=yes -o ConnectTimeout=12 \
  -o ServerAliveInterval=20 -o ServerAliveCountMax=3 \
  -i "$RELAYWA_GCE_SSH_KEY" \
  -R "$SOCKET:$PG_IP:5432" \
  -R "127.0.0.1:16379:$REDIS_IP:6379" \
  -R "127.0.0.1:13002:$WORKER_IP:3002" \
  "$RELAYWA_GCE_SSH_USER@$RELAYWA_GCE_SSH_HOST"
echo "Secure GCE reverse tunnel established; VPS containers unchanged."
