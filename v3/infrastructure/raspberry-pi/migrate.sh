#!/usr/bin/env bash
set -euo pipefail

PB_BIN="${PB_BIN:-/opt/language-school/pocketbase/pocketbase}"
PB_DATA="${PB_DATA:-/var/lib/language-school/pb_data}"
PB_MIGRATIONS="${PB_MIGRATIONS:-/opt/language-school/pocketbase/pb_migrations}"
SERVICE="${SERVICE:-language-school-pocketbase.service}"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

if [[ ! -x "$PB_BIN" ]]; then
  echo "PocketBase binary not found: $PB_BIN" >&2
  exit 1
fi

if [[ ! -d "$PB_MIGRATIONS" ]]; then
  echo "Migrations directory not found: $PB_MIGRATIONS" >&2
  exit 1
fi

was_active=0
if systemctl is-active --quiet "$SERVICE"; then
  was_active=1
  systemctl stop "$SERVICE"
fi

restart_if_needed() {
  if [[ "$was_active" -eq 1 ]]; then
    systemctl start "$SERVICE" || true
  fi
}
trap restart_if_needed EXIT

set +e
MIGRATION_OUTPUT=$("$PB_BIN" migrate up --dir="$PB_DATA" --migrationsDir="$PB_MIGRATIONS" 2>&1)
MIGRATION_EXIT=$?
set -e
printf '%s\n' "$MIGRATION_OUTPUT"

if [[ "$MIGRATION_EXIT" -ne 0 ]] || printf '%s\n' "$MIGRATION_OUTPUT" | grep -Eqi '(^|[[:space:]])Error:|failed to apply migration'; then
  echo 'Migration failed. PocketBase will be restarted if it was previously active.' >&2
  exit 1
fi

trap - EXIT
if [[ "$was_active" -eq 1 ]]; then
  systemctl start "$SERVICE"
fi

echo 'PocketBase migrations applied successfully.'
