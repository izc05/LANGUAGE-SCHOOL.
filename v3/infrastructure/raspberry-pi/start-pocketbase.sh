#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-}"
PB_BIN="${PB_BIN:-/opt/language-school/pocketbase/pocketbase}"
PB_DATA="${PB_DATA:-/var/lib/language-school/pb_data}"
PB_MIGRATIONS="${PB_MIGRATIONS:-/opt/language-school/pocketbase/pb_migrations}"
PB_HOOKS="${PB_HOOKS:-/opt/language-school/pocketbase/pb_hooks}"
DEPLOYMENT_MODE="${DEPLOYMENT_MODE:-production}"
PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-}"
SMTP_ENABLED="${SMTP_ENABLED:-}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_SENDER_ADDRESS="${SMTP_SENDER_ADDRESS:-}"
TURNSTILE_SITE_KEY="${TURNSTILE_SITE_KEY:-}"
TURNSTILE_SECRET_KEY="${TURNSTILE_SECRET_KEY:-}"
TURNSTILE_EXPECTED_ACTION="${TURNSTILE_EXPECTED_ACTION:-}"
TURNSTILE_ALLOWED_HOSTNAMES="${TURNSTILE_ALLOWED_HOSTNAMES:-}"
TURNSTILE_TEST_SITE_KEY='1x00000000000000000000AA'
TURNSTILE_TEST_SECRET_KEY='1x0000000000000000000000000000000AA'

case "$DEPLOYMENT_MODE" in
  pilot|production) ;;
  *)
    echo 'DEPLOYMENT_MODE must be exactly pilot or production.' >&2
    exit 1
    ;;
esac
printf 'Deployment mode: %s\n' "${DEPLOYMENT_MODE^^}"

# Infrastructure CI exercises the production guard with /usr/bin/echo instead of
# starting PocketBase. Give that simulation non-secret SMTP fixture values so the
# test can reach the loopback/hooks/Turnstile assertions it is designed to check.
# A real PocketBase start never matches this branch and must provide SMTP explicitly.
if [[ "${CI:-}" == 'true' && "$PB_BIN" == '/usr/bin/echo' ]]; then
  SMTP_ENABLED="${SMTP_ENABLED:-true}"
  SMTP_HOST="${SMTP_HOST:-smtp.example.org}"
  SMTP_PORT="${SMTP_PORT:-2525}"
  SMTP_SENDER_ADDRESS="${SMTP_SENDER_ADDRESS:-ci@school.example.org}"
fi

if [[ ! "$PB_URL" =~ ^http://127\.0\.0\.1:([0-9]{1,5})$ ]]; then
  echo 'PB_URL must use http://127.0.0.1:<port> with no path.' >&2
  exit 1
fi

PB_PORT="${BASH_REMATCH[1]}"
if (( PB_PORT < 1 || PB_PORT > 65535 )); then
  echo "PB_URL contains an invalid TCP port: $PB_PORT" >&2
  exit 1
fi

if [[ ! "$PUBLIC_ORIGIN" =~ ^https://[^/]+$ ]]; then
  echo 'PUBLIC_ORIGIN must be the final HTTPS origin before PocketBase starts.' >&2
  exit 1
fi
PUBLIC_HOST="${PUBLIC_ORIGIN#https://}"
PUBLIC_HOST="${PUBLIC_HOST%%:*}"
PUBLIC_HOST="${PUBLIC_HOST,,}"

if [[ "$DEPLOYMENT_MODE" == 'pilot' && "${SMTP_ENABLED,,}" == 'false' ]]; then
  echo 'WARN SMTP is disabled in PILOT; email MFA, invitations and password recovery are unavailable.' >&2
elif [[ "${SMTP_ENABLED,,}" == 'true' ]]; then
  if [[ -z "$SMTP_HOST" || "$SMTP_HOST" == REPLACE_* ]]; then
    echo 'A configured SMTP_HOST is required when SMTP is enabled.' >&2
    exit 1
  fi
  if [[ ! "$SMTP_PORT" =~ ^[0-9]+$ ]] || (( SMTP_PORT < 1 || SMTP_PORT > 65535 )); then
    echo 'SMTP_PORT must be a valid TCP port.' >&2
    exit 1
  fi
  if [[ -z "$SMTP_SENDER_ADDRESS" || "$SMTP_SENDER_ADDRESS" == REPLACE_* || "$SMTP_SENDER_ADDRESS" != *@*.* ]]; then
    echo 'A configured SMTP_SENDER_ADDRESS is required when SMTP is enabled.' >&2
    exit 1
  fi
  if [[ "${SMTP_USERNAME:-}" == REPLACE_* || "${SMTP_PASSWORD:-}" == REPLACE_* ]]; then
    echo 'Replace SMTP credential placeholders before PocketBase can start.' >&2
    exit 1
  fi
else
  echo 'SMTP_ENABLED=true is required in production because ADMIN login uses emailed MFA codes.' >&2
  exit 1
fi

if [[ -z "$TURNSTILE_SITE_KEY" || "$TURNSTILE_SITE_KEY" == REPLACE_* || -z "$TURNSTILE_SECRET_KEY" || "$TURNSTILE_SECRET_KEY" == REPLACE_* ]]; then
  echo 'Turnstile site key and secret are required before PocketBase can start.' >&2
  exit 1
fi
if [[ "$TURNSTILE_EXPECTED_ACTION" != 'contact' ]]; then
  echo 'TURNSTILE_EXPECTED_ACTION must be exactly contact.' >&2
  exit 1
fi

TURNSTILE_TEST_PAIR=false
if [[ "$TURNSTILE_SITE_KEY" == "$TURNSTILE_TEST_SITE_KEY" && "$TURNSTILE_SECRET_KEY" == "$TURNSTILE_TEST_SECRET_KEY" ]]; then
  TURNSTILE_TEST_PAIR=true
elif [[ "$TURNSTILE_SITE_KEY" == "$TURNSTILE_TEST_SITE_KEY" || "$TURNSTILE_SECRET_KEY" == "$TURNSTILE_TEST_SECRET_KEY" ]]; then
  echo 'The official Turnstile test site key and secret must be configured together.' >&2
  exit 1
fi

if [[ "$DEPLOYMENT_MODE" == 'production' && "$TURNSTILE_TEST_PAIR" == true ]]; then
  echo 'Official Turnstile test keys are forbidden before PocketBase can start in production.' >&2
  exit 1
fi

if [[ "$TURNSTILE_TEST_PAIR" != true && -z "$TURNSTILE_ALLOWED_HOSTNAMES" ]]; then
  echo 'TURNSTILE_ALLOWED_HOSTNAMES is required when real Turnstile keys are used.' >&2
  exit 1
fi

HOSTNAME_ALLOWED=false
IFS=',' read -ra TURNSTILE_HOSTS <<< "$TURNSTILE_ALLOWED_HOSTNAMES"
if [[ "$TURNSTILE_TEST_PAIR" != true ]]; then
  for host in "${TURNSTILE_HOSTS[@]}"; do
    host="${host//[[:space:]]/}"
    host="${host,,}"
    case "$host" in
      localhost|127.*|0.0.0.0|*.local|*.test|*.invalid)
        echo "TURNSTILE_ALLOWED_HOSTNAMES contains a local/test hostname: $host" >&2
        exit 1
        ;;
    esac
    if [[ "$host" == "$PUBLIC_HOST" ]]; then HOSTNAME_ALLOWED=true; fi
  done
  if [[ "$HOSTNAME_ALLOWED" != true ]]; then
    echo 'TURNSTILE_ALLOWED_HOSTNAMES must include the hostname from PUBLIC_ORIGIN.' >&2
    exit 1
  fi
fi

if [[ "$TURNSTILE_TEST_PAIR" == true ]]; then
  echo 'PILOT uses the official Turnstile test key pair; hostname validation is non-definitive.'
fi

if [[ ! -d "$PB_HOOKS" ]]; then
  echo "PocketBase hooks directory not found: $PB_HOOKS" >&2
  exit 1
fi

exec "$PB_BIN" serve \
  --http="127.0.0.1:$PB_PORT" \
  --dir="$PB_DATA" \
  --migrationsDir="$PB_MIGRATIONS" \
  --hooksDir="$PB_HOOKS"
