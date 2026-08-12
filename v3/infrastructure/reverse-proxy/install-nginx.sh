#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_CONF="$SCRIPT_DIR/language-school.nginx.conf"
TARGET_CONF="/etc/nginx/sites-available/language-school.conf"
ENABLED_CONF="/etc/nginx/sites-enabled/language-school.conf"
FRONTEND_ROOT="${FRONTEND_ROOT:-/opt/language-school/frontend}"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

if [[ ! -f "$SOURCE_CONF" ]]; then
  echo "Nginx config not found: $SOURCE_CONF" >&2
  exit 1
fi

if ! command -v nginx >/dev/null; then
  if ! command -v apt-get >/dev/null; then
    echo 'nginx is not installed and apt-get is unavailable.' >&2
    exit 1
  fi
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
fi

install -d -m 0755 -o root -g root "$FRONTEND_ROOT"
install -m 0644 -o root -g root "$SOURCE_CONF" "$TARGET_CONF"
ln -sfn "$TARGET_CONF" "$ENABLED_CONF"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

echo 'Nginx installed and listening only on 127.0.0.1:8080.'
