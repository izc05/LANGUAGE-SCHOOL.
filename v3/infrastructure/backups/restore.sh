#!/usr/bin/env bash
set -euo pipefail

PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"
if [[ ! -f "$PRODUCTION_ENV" ]]; then
  echo "Production environment file not found: $PRODUCTION_ENV" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$PRODUCTION_ENV"

SERVICE="${SERVICE:-language-school-pocketbase.service}"
: "${PB_URL:?PB_URL is required in $PRODUCTION_ENV}"
DATA_PARENT="${DATA_PARENT:-/var/lib/language-school}"
PB_DATA_NAME="${PB_DATA_NAME:-pb_data}"
PB_DATA="$DATA_PARENT/$PB_DATA_NAME"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

ARCHIVE="${1:-}"
if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo 'Usage: sudo restore.sh /path/language-school-YYYYMMDDTHHMMSSZ.tar.gz' >&2
  exit 1
fi

for command in tar sha256sum systemctl curl; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

CHECKSUM="$ARCHIVE.sha256"
if [[ -f "$CHECKSUM" ]]; then
  (
    cd "$(dirname "$ARCHIVE")"
    sha256sum -c "$(basename "$CHECKSUM")"
  )
else
  echo 'WARNING: checksum file is missing; refusing restore by default.' >&2
  echo 'Create/restore the matching .sha256 file before continuing.' >&2
  exit 1
fi

if ! tar -tzf "$ARCHIVE" | grep -Eq "^${PB_DATA_NAME}/"; then
  echo "Archive does not contain expected ${PB_DATA_NAME}/ directory." >&2
  exit 1
fi

TIMESTAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
PREVIOUS="$DATA_PARENT/${PB_DATA_NAME}.before-restore-$TIMESTAMP"

systemctl stop "$SERVICE" 2>/dev/null || true

had_previous=0
if [[ -d "$PB_DATA" ]]; then
  mv "$PB_DATA" "$PREVIOUS"
  had_previous=1
fi

rollback() {
  systemctl stop "$SERVICE" 2>/dev/null || true
  rm -rf "$PB_DATA"
  if [[ "$had_previous" -eq 1 && -d "$PREVIOUS" ]]; then
    mv "$PREVIOUS" "$PB_DATA"
  fi
  chown -R languageschool:languageschool "$PB_DATA" 2>/dev/null || true
  systemctl start "$SERVICE" 2>/dev/null || true
}
trap rollback ERR

tar -C "$DATA_PARENT" -xzf "$ARCHIVE"
chown -R languageschool:languageschool "$PB_DATA"
chmod 0700 "$PB_DATA"
systemctl start "$SERVICE"

for attempt in {1..30}; do
  if curl -fsS --max-time 5 "$PB_URL/api/health" >/dev/null; then
    trap - ERR
    echo 'Restore health check: SUCCESS'
    if [[ "$had_previous" -eq 1 ]]; then
      echo "Previous data preserved at: $PREVIOUS"
    fi
    exit 0
  fi
  sleep 1
done

echo 'Restored PocketBase did not become healthy; rolling back automatically.' >&2
false
