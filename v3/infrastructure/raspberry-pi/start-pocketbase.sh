#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-}"
PB_BIN="${PB_BIN:-/opt/language-school/pocketbase/pocketbase}"
PB_DATA="${PB_DATA:-/var/lib/language-school/pb_data}"
PB_MIGRATIONS="${PB_MIGRATIONS:-/opt/language-school/pocketbase/pb_migrations}"
PB_HOOKS="${PB_HOOKS:-/opt/language-school/pocketbase/pb_hooks}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-}"
TURNSTILE_SECRET_KEY="${TURNSTILE_SECRET_KEY:-}"
TURNSTILE_EXPECTED_ACTION="${TURNSTILE_EXPECTED_ACTION:-}"
TURNSTILE_ALLOWED_HOSTNAMES="${TURNSTILE_ALLOWED_HOSTNAMES:-}"

if [[ ! "$PB_URL" =~ ^http://127\.0\.0\.1:([0-9]{1,5})$ ]]; then
  echo 'PB_URL must use http://127.0.0.1:<port> with no path.' >&2
  exit 1
fi
PB_PORT="${BASH_REMATCH[1]}"

if (( PB_PORT < 1 || PB_PORT > 65535 )); then
  echo "PB_URL contains an invalid TCP port: $PB_PORT" >&2
  exit 1
fi

if [[ -z "$TURNSTILE_SECRET_KEY" || "$TURNSTILE_SECRET_KEY" == 'replace-with-real-secret-key' ]]; then
  echo 'TURNSTILE_SECRET_KEY must contain the real server-side Turnstile secret before PocketBase can start.' >&2
  exit 1
fi

if [[ "$TURNSTILE_EXPECTED_ACTION" != 'contact' ]]; then
  echo 'TURNSTILE_EXPECTED_ACTION must be exactly contact in production.' >&2
  exit 1
fi

if [[ ! "$PUBLIC_ORIGIN" =~ ^https://([A-Za-z0-9.-]+)$ ]]; then
  echo 'PUBLIC_ORIGIN must use HTTPS with a hostname and no path or port.' >&2
  exit 1
fi
PUBLIC_HOST="${BASH_REMATCH[1],,}"

if [[ -z "$TURNSTILE_ALLOWED_HOSTNAMES" || "$TURNSTILE_ALLOWED_HOSTNAMES" == 'english.example.com' ]]; then
  echo 'TURNSTILE_ALLOWED_HOSTNAMES must contain the real production hostname.' >&2
  exit 1
fi

HOST_ALLOWED=false
IFS=',' read -r -a TURNSTILE_HOSTS <<< "$TURNSTILE_ALLOWED_HOSTNAMES"
for RAW_HOST in "${TURNSTILE_HOSTS[@]}"; do
  HOST="${RAW_HOST#"${RAW_HOST%%[![:space:]]*}"}"
  HOST="${HOST%"${HOST##*[![:space:]]}"}"
  HOST="${HOST,,}"

  if [[ ! "$HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
    echo "Invalid hostname in TURNSTILE_ALLOWED_HOSTNAMES: $RAW_HOST" >&2
    exit 1
  fi

  if [[ "$HOST" == "$PUBLIC_HOST" ]]; then
    HOST_ALLOWED=true
  fi
done

if [[ "$HOST_ALLOWED" != true ]]; then
  echo 'TURNSTILE_ALLOWED_HOSTNAMES must include the hostname from PUBLIC_ORIGIN.' >&2
  exit 1
fi

exec "$PB_BIN" serve \
  --http="127.0.0.1:$PB_PORT" \
  --dir="$PB_DATA" \
  --migrationsDir="$PB_MIGRATIONS" \
  --hooksDir="$PB_HOOKS"
