#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_CONF="$SCRIPT_DIR/language-school.nginx.conf"
TARGET_CONF="/etc/nginx/sites-available/language-school.conf"
ENABLED_CONF="/etc/nginx/sites-enabled/language-school.conf"
FRONTEND_ROOT="${FRONTEND_ROOT:-/opt/language-school/frontend}"
PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

if [[ ! -f "$SOURCE_CONF" ]]; then
  echo "Nginx config not found: $SOURCE_CONF" >&2
  exit 1
fi

if [[ ! -f "$PRODUCTION_ENV" ]]; then
  echo "Production environment file not found: $PRODUCTION_ENV" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$PRODUCTION_ENV"
PB_URL="${PB_URL:-}"
PROXY_URL="${PROXY_URL:-}"

parse_loopback_origin() {
  local label="$1"
  local value="$2"
  if [[ ! "$value" =~ ^http://127\.0\.0\.1:([0-9]{1,5})$ ]]; then
    echo "$label must use http://127.0.0.1:<port> with no path." >&2
    return 1
  fi
  local port="${BASH_REMATCH[1]}"
  if (( port < 1 || port > 65535 )); then
    echo "$label contains an invalid TCP port: $port" >&2
    return 1
  fi
  printf '%s' "$port"
}

PB_PORT="$(parse_loopback_origin PB_URL "$PB_URL")"
PROXY_PORT="$(parse_loopback_origin PROXY_URL "$PROXY_URL")"
if [[ "$PB_PORT" == "$PROXY_PORT" ]]; then
  echo 'PB_URL and PROXY_URL must use different ports.' >&2
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

nginx -t

install -d -m 0755 -o root -g root "$FRONTEND_ROOT"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
RENDERED_CONF="$TMP_DIR/language-school.conf"
CONFIG_CONTENT="$(<"$SOURCE_CONF")"
CONFIG_CONTENT="${CONFIG_CONTENT//__PROXY_LISTEN__/127.0.0.1:$PROXY_PORT}"
CONFIG_CONTENT="${CONFIG_CONTENT//__PB_URL__/$PB_URL}"
printf '%s\n' "$CONFIG_CONTENT" > "$RENDERED_CONF"

if [[ -e "$ENABLED_CONF" && ! -L "$ENABLED_CONF" ]]; then
  echo "Refusing to replace non-symlink Nginx site: $ENABLED_CONF" >&2
  exit 1
fi

HAD_TARGET=0
if [[ -f "$TARGET_CONF" ]]; then
  HAD_TARGET=1
  cp -a "$TARGET_CONF" "$TMP_DIR/previous-language-school.conf"
fi

HAD_ENABLED=0
PREVIOUS_ENABLED_TARGET=''
if [[ -L "$ENABLED_CONF" ]]; then
  HAD_ENABLED=1
  PREVIOUS_ENABLED_TARGET="$(readlink "$ENABLED_CONF")"
fi

install -m 0644 -o root -g root "$RENDERED_CONF" "$TARGET_CONF"
ln -sfn "$TARGET_CONF" "$ENABLED_CONF"

if ! nginx -t; then
  echo 'New Language School Nginx configuration is invalid; restoring the previous site file.' >&2
  if [[ "$HAD_TARGET" -eq 1 ]]; then
    install -m 0644 -o root -g root "$TMP_DIR/previous-language-school.conf" "$TARGET_CONF"
  else
    rm -f "$TARGET_CONF"
  fi
  if [[ "$HAD_ENABLED" -eq 1 ]]; then
    ln -sfn "$PREVIOUS_ENABLED_TARGET" "$ENABLED_CONF"
  else
    rm -f "$ENABLED_CONF"
  fi
  nginx -t || true
  exit 1
fi

systemctl enable nginx
if systemctl is-active --quiet nginx; then
  systemctl reload nginx
else
  systemctl start nginx
fi

echo "Nginx configured for Language School at $PROXY_URL."
echo "PocketBase API upstream: $PB_URL."
