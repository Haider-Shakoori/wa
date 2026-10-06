#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
WA_AUTH_DIR="${WA_AUTH_DIR:-.data/wa-auth}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" --format=custom --file="$BACKUP_DIR/relaywa-db-$STAMP.dump"

if [ -d "$WA_AUTH_DIR" ]; then
  tar -czf "$BACKUP_DIR/relaywa-auth-$STAMP.tar.gz" -C "$(dirname "$WA_AUTH_DIR")" "$(basename "$WA_AUTH_DIR")"
fi

echo "Backup completed: $STAMP"
