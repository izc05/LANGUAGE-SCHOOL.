#!/usr/bin/env bash
set -euo pipefail

PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"
FRONTEND_TARGET="${FRONTEND_TARGET:-/opt/language-school/frontend}"
FRONTEND_PREVIOUS="${FRONTEND_PREVIOUS:-${FRONTEND_TARGET}.previous}"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

if [[ ! -f "$PRODUCTION_ENV" ]]; then
  echo "Production environment file not found: $PRODUCTION_ENV" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$PRODUCTION_ENV"

PROXY_URL="${PROXY_URL:-}"
if [[ ! "$PROXY_URL" =~ ^http://127\.0\.0\.1:[0-9]+$ ]]; then
  echo 'PROXY_URL must use an explicit 127.0.0.1 loopback HTTP endpoint.' >&2
  exit 1
fi

for command in curl sha256sum; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

if [[ ! -f "$FRONTEND_PREVIOUS/index.html" ]]; then
  echo "No rollback frontend is available at $FRONTEND_PREVIOUS" >&2
  exit 1
fi

EXPECTED_INDEX_SHA="$(sha256sum "$FRONTEND_PREVIOUS/index.html" | awk '{print $1}')"
TIMESTAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
FAILED_FRONTEND="${FRONTEND_TARGET}.failed-$TIMESTAMP"
current_moved=0
previous_promoted=0

restore_current_on_error() {
  set +e
  if [[ "$previous_promoted" -eq 1 && -d "$FRONTEND_TARGET" ]]; then
    mv -- "$FRONTEND_TARGET" "$FRONTEND_PREVIOUS"
  fi
  if [[ "$current_moved" -eq 1 && -d "$FAILED_FRONTEND" ]]; then
    mv -- "$FAILED_FRONTEND" "$FRONTEND_TARGET"
  fi
}
trap restore_current_on_error ERR

if [[ -d "$FRONTEND_TARGET" ]]; then
  mv -- "$FRONTEND_TARGET" "$FAILED_FRONTEND"
  current_moved=1
fi
mv -- "$FRONTEND_PREVIOUS" "$FRONTEND_TARGET"
previous_promoted=1

for attempt in {1..15}; do
  PROXY_BODY="$(mktemp)"
  if curl -fsS --max-time 5 "$PROXY_URL/" -o "$PROXY_BODY"; then
    ACTUAL_INDEX_SHA="$(sha256sum "$PROXY_BODY" | awk '{print $1}')"
    rm -f "$PROXY_BODY"
    if [[ "$ACTUAL_INDEX_SHA" == "$EXPECTED_INDEX_SHA" ]]; then
      trap - ERR
      echo 'Frontend rollback: SUCCESS'
      printf 'Restored frontend: %s\n' "$FRONTEND_TARGET"
      if [[ "$current_moved" -eq 1 ]]; then
        printf 'Rejected frontend preserved for diagnosis at: %s\n' "$FAILED_FRONTEND"
      fi
      exit 0
    fi
  else
    rm -f "$PROXY_BODY"
  fi
  sleep 1
done

echo 'Rollback candidate did not become reachable through the local proxy; restoring the pre-rollback frontend.' >&2
false
