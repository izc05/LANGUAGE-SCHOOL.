#!/usr/bin/env bash
set -euo pipefail

PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"
if [[ -r "$PRODUCTION_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$PRODUCTION_ENV"
elif command -v sudo >/dev/null && sudo test -r "$PRODUCTION_ENV"; then
  # production.env is intentionally root-owned; read it without relaxing its permissions.
  # shellcheck disable=SC1090
  source <(sudo cat -- "$PRODUCTION_ENV")
else
  echo "Production environment file not found or unreadable: $PRODUCTION_ENV" >&2
  exit 1
fi

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
