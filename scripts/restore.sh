#!/usr/bin/env sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${DB_BACKUP:?DB_BACKUP is required}"

pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$DB_BACKUP"

if [ -n "${AUTH_BACKUP:-}" ]; then
  TARGET="${WA_AUTH_DIR:-.data/wa-auth}"
  mkdir -p "$(dirname "$TARGET")"
  rm -rf "$TARGET"
  tar -xzf "$AUTH_BACKUP" -C "$(dirname "$TARGET")"
fi

echo "Restore completed"
