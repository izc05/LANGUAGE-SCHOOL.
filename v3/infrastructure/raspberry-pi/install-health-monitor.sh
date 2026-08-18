#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo 'Run this installer as root.' >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/usr/local/lib/language-school"
SYSTEMD_DIR="/etc/systemd/system"

install -d -o root -g root -m 0755 "$INSTALL_DIR"
install -o root -g root -m 0755 "$SCRIPT_DIR/health-check.sh" "$INSTALL_DIR/health-check.sh"
install -o root -g root -m 0644 "$SCRIPT_DIR/language-school-health.service" "$SYSTEMD_DIR/language-school-health.service"
install -o root -g root -m 0644 "$SCRIPT_DIR/language-school-health.timer" "$SYSTEMD_DIR/language-school-health.timer"

systemctl daemon-reload
systemctl enable --now language-school-health.timer

echo 'Language School health monitor installed.'
echo 'Inspect with: systemctl status language-school-health.timer'
echo 'Recent checks: journalctl -u language-school-health.service --since "30 minutes ago"'
