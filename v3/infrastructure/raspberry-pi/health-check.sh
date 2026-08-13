#!/usr/bin/env bash
set -euo pipefail

PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"
if [[ ! -f "$PRODUCTION_ENV" ]]; then
  echo "Production environment file not found: $PRODUCTION_ENV" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$PRODUCTION_ENV"

: "${PB_URL:?PB_URL is required in $PRODUCTION_ENV}"
: "${PROXY_URL:?PROXY_URL is required in $PRODUCTION_ENV}"
SERVICE="${SERVICE:-language-school-pocketbase.service}"

fail=0

check() {
  local label="$1"
  shift
  if "$@"; then
    printf 'OK   %s\n' "$label"
  else
    printf 'FAIL %s\n' "$label" >&2
    fail=1
  fi
}

check 'PocketBase systemd service' systemctl is-active --quiet "$SERVICE"
check 'PocketBase direct health' curl -fsS --max-time 5 "$PB_URL/api/health"
check 'Reverse proxy API health' curl -fsS --max-time 5 "$PROXY_URL/api/health"
check 'Frontend through reverse proxy' curl -fsS --max-time 5 "$PROXY_URL/"

proxy_admin_blocked() {
  [[ "$(curl -sS --max-time 5 --output /dev/null --write-out '%{http_code}' "$PROXY_URL/_/")" == '404' ]]
}

check 'PocketBase admin UI blocked by reverse proxy' proxy_admin_blocked

if [[ "$fail" -ne 0 ]]; then
  echo 'Language School health check failed.' >&2
  exit 1
fi

echo 'Language School health check: SUCCESS'
