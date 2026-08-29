#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FULL_BACKUP_SCRIPT="$SCRIPT_DIR/full-backup.sh"
SERVICE_SOURCE="$SCRIPT_DIR/language-school-full-backup.service"
TIMER_SOURCE="$SCRIPT_DIR/language-school-full-backup.timer"
TARGET_SCRIPT="/usr/local/sbin/language-school-full-backup"
TARGET_SERVICE="/etc/systemd/system/language-school-full-backup.service"
TARGET_TIMER="/etc/systemd/system/language-school-full-backup.timer"
PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"
FULL_BACKUP_KEY="${FULL_BACKUP_KEY:-/etc/language-school/full-backup.key}"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

for file in "$FULL_BACKUP_SCRIPT" "$SERVICE_SOURCE" "$TIMER_SOURCE"; do
  [[ -f "$file" ]] || { echo "Missing file: $file" >&2; exit 1; }
done

for command in mountpoint openssl systemctl; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

[[ -f "$PRODUCTION_ENV" ]] || {
  echo "Production environment file is missing: $PRODUCTION_ENV" >&2
  exit 1
}

# shellcheck disable=SC1090
source "$PRODUCTION_ENV"
BACKUP_MOUNT="${BACKUP_MOUNT:-/mnt/language-school-backup}"
mountpoint -q "$BACKUP_MOUNT" || {
  echo "Backup mount is not active: $BACKUP_MOUNT" >&2
  exit 1
}

if [[ ! -f "$FULL_BACKUP_KEY" ]]; then
  umask 0077
  openssl rand -hex -out "$FULL_BACKUP_KEY" 32
fi
chown root:root "$FULL_BACKUP_KEY"
chmod 0600 "$FULL_BACKUP_KEY"

install -m 0750 -o root -g root "$FULL_BACKUP_SCRIPT" "$TARGET_SCRIPT"
install -m 0644 -o root -g root "$SERVICE_SOURCE" "$TARGET_SERVICE"
install -m 0644 -o root -g root "$TIMER_SOURCE" "$TARGET_TIMER"
systemctl daemon-reload
systemctl enable --now language-school-full-backup.timer

echo 'Weekly encrypted full-backup timer enabled.'
echo "Recovery key created or preserved at $FULL_BACKUP_KEY."
echo 'Store an offline copy of that key separately from both the mini PC and backup disk.'
systemctl list-timers language-school-full-backup.timer --no-pager
