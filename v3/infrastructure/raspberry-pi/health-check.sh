#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
PROXY_URL="${PROXY_URL:-http://127.0.0.1:8080}"
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

if [[ "$fail" -ne 0 ]]; then
  echo 'Language School health check failed.' >&2
  exit 1
fi

echo 'Language School health check: SUCCESS'
