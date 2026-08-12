#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"
SERVICE_SOURCE="$SCRIPT_DIR/language-school-backup.service"
TIMER_SOURCE="$SCRIPT_DIR/language-school-backup.timer"
TARGET_SCRIPT="/usr/local/sbin/language-school-backup"
TARGET_SERVICE="/etc/systemd/system/language-school-backup.service"
TARGET_TIMER="/etc/systemd/system/language-school-backup.timer"
PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

for file in "$BACKUP_SCRIPT" "$SERVICE_SOURCE" "$TIMER_SOURCE"; do
  [[ -f "$file" ]] || { echo "Missing file: $file" >&2; exit 1; }
done

if [[ ! -f "$PRODUCTION_ENV" ]]; then
  echo "Production environment file is missing: $PRODUCTION_ENV" >&2
  echo 'Copy v3/infrastructure/.env.example there and set BACKUP_MOUNT first.' >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$PRODUCTION_ENV"
BACKUP_MOUNT="${BACKUP_MOUNT:-/mnt/language-school-backup}"

if ! mountpoint -q "$BACKUP_MOUNT"; then
  echo "Backup mount is not active: $BACKUP_MOUNT" >&2
  exit 1
fi

install -m 0750 -o root -g root "$BACKUP_SCRIPT" "$TARGET_SCRIPT"
install -m 0644 -o root -g root "$SERVICE_SOURCE" "$TARGET_SERVICE"
install -m 0644 -o root -g root "$TIMER_SOURCE" "$TARGET_TIMER"
systemctl daemon-reload
systemctl enable --now language-school-backup.timer

echo 'Nightly backup timer enabled.'
systemctl list-timers language-school-backup.timer --no-pager
