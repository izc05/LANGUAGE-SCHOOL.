#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-}"
PB_BIN="${PB_BIN:-/opt/language-school/pocketbase/pocketbase}"
PB_DATA="${PB_DATA:-/var/lib/language-school/pb_data}"
PB_MIGRATIONS="${PB_MIGRATIONS:-/opt/language-school/pocketbase/pb_migrations}"
PB_HOOKS="${PB_HOOKS:-/opt/language-school/pocketbase/pb_hooks}"

if [[ ! "$PB_URL" =~ ^http://127\.0\.0\.1:([0-9]{1,5})$ ]]; then
  echo 'PB_URL must use http://127.0.0.1:<port> with no path.' >&2
  exit 1
fi

if [[ -z "${TURNSTILE_SECRET_KEY:-}" ]]; then
  echo 'TURNSTILE_SECRET_KEY is required for the protected contact endpoint.' >&2
  exit 1
fi

PB_PORT="${BASH_REMATCH[1]}"
if (( PB_PORT < 1 || PB_PORT > 65535 )); then
  echo "PB_URL contains an invalid TCP port: $PB_PORT" >&2
  exit 1
fi

exec "$PB_BIN" serve \
  --http="127.0.0.1:$PB_PORT" \
  --dir="$PB_DATA" \
  --migrationsDir="$PB_MIGRATIONS" \
  --hooksDir="$PB_HOOKS"
