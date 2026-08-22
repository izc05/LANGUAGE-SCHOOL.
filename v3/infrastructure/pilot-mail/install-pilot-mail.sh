#!/usr/bin/env bash
set -euo pipefail

PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR='/opt/language-school/pilot-mail'
SERVICE_TARGET='/etc/systemd/system/language-school-pilot-mail.service'
CLI_TARGET='/usr/local/bin/language-school-pilot-mail'

if [[ "$EUID" -ne 0 ]]; then
  echo 'Run this installer as root (sudo).' >&2
  exit 1
fi
if [[ ! -r "$PRODUCTION_ENV" ]]; then
  echo "PILOT environment is missing or unreadable: $PRODUCTION_ENV" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$PRODUCTION_ENV"

if [[ "${DEPLOYMENT_MODE:-}" != 'pilot' ]]; then
  echo 'PILOT mail capture can only be installed when DEPLOYMENT_MODE=pilot.' >&2
  exit 1
fi
if [[ "${PILOT_MAIL_CAPTURE:-}" != 'true' || "${SMTP_ENABLED:-}" != 'true' ]]; then
  echo 'PILOT_MAIL_CAPTURE=true and SMTP_ENABLED=true are required.' >&2
  exit 1
fi
if [[ "${SMTP_HOST:-}" != '127.0.0.1' || "${SMTP_TLS:-}" != 'false' ]]; then
  echo 'PILOT mail capture requires SMTP_HOST=127.0.0.1 and SMTP_TLS=false.' >&2
  exit 1
fi
if [[ -n "${SMTP_USERNAME:-}" || -n "${SMTP_PASSWORD:-}" || -n "${SMTP_AUTH_METHOD:-}" ]]; then
  echo 'PILOT mail capture requires empty SMTP authentication fields.' >&2
  exit 1
fi
if [[ ! "${SMTP_PORT:-}" =~ ^[0-9]+$ ]] || (( SMTP_PORT < 1 || SMTP_PORT > 65535 )); then
  echo 'SMTP_PORT must be a valid TCP port.' >&2
  exit 1
fi

command -v node >/dev/null || { echo 'Node.js is required.' >&2; exit 1; }
id languageschool >/dev/null 2>&1 || { echo 'Service user languageschool is missing.' >&2; exit 1; }

install -d -m 0755 -o root -g root "$TARGET_DIR"
install -m 0644 -o root -g root "$SCRIPT_DIR/pilot-mail-server.mjs" "$TARGET_DIR/pilot-mail-server.mjs"
install -m 0755 -o root -g root "$SCRIPT_DIR/language-school-pilot-mail.mjs" "$CLI_TARGET"
install -m 0644 -o root -g root "$SCRIPT_DIR/language-school-pilot-mail.service" "$SERVICE_TARGET"

systemctl daemon-reload
systemctl enable --now language-school-pilot-mail.service

echo 'Language School PILOT mail capture installed.'
echo 'SMTP listener: 127.0.0.1 only.'
echo 'No web mailbox was installed.'
echo 'Read the latest OTP locally with: sudo language-school-pilot-mail latest <email>'
