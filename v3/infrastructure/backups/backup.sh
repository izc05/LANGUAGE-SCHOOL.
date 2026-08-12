#!/usr/bin/env bash
set -euo pipefail

SERVICE="${SERVICE:-language-school-pocketbase.service}"
DATA_PARENT="${DATA_PARENT:-/var/lib/language-school}"
PB_DATA_NAME="${PB_DATA_NAME:-pb_data}"
PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"

if [[ -f "$PRODUCTION_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$PRODUCTION_ENV"
fi

BACKUP_MOUNT="${BACKUP_MOUNT:-/mnt/language-school-backup}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
BACKUP_DIR="$BACKUP_MOUNT/language-school"
PB_DATA="$DATA_PARENT/$PB_DATA_NAME"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

for command in mountpoint tar sha256sum find systemctl; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

if ! mountpoint -q "$BACKUP_MOUNT"; then
  echo "Backup aborted: $BACKUP_MOUNT is not an active mountpoint." >&2
  exit 1
fi

if [[ ! -d "$PB_DATA" ]]; then
  echo "PocketBase data directory not found: $PB_DATA" >&2
  exit 1
fi

install -d -m 0700 -o root -g root "$BACKUP_DIR"

TIMESTAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
ARCHIVE="$BACKUP_DIR/language-school-$TIMESTAMP.tar.gz"
PARTIAL="$ARCHIVE.partial"
CHECKSUM="$ARCHIVE.sha256"

was_active=0
if systemctl is-active --quiet "$SERVICE"; then
  was_active=1
  systemctl stop "$SERVICE"
fi

restart_service() {
  rm -f "$PARTIAL"
  if [[ "$was_active" -eq 1 ]]; then
    systemctl start "$SERVICE" || true
  fi
}
trap restart_service EXIT

tar -C "$DATA_PARENT" -czf "$PARTIAL" "$PB_DATA_NAME"
mv "$PARTIAL" "$ARCHIVE"
(
  cd "$BACKUP_DIR"
  sha256sum "$(basename "$ARCHIVE")" > "$(basename "$CHECKSUM")"
)
sync

trap - EXIT
if [[ "$was_active" -eq 1 ]]; then
  systemctl start "$SERVICE"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f -name 'language-school-*.tar.gz' -mtime "+$BACKUP_RETENTION_DAYS" -delete
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'language-school-*.tar.gz.sha256' -mtime "+$BACKUP_RETENTION_DAYS" -delete

printf 'Backup created: %s\n' "$ARCHIVE"
printf 'Checksum: %s\n' "$CHECKSUM"
