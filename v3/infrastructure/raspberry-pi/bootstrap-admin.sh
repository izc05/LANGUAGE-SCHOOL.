#!/usr/bin/env bash
set -euo pipefail

PB_BIN="${PB_BIN:-/opt/language-school/pocketbase/pocketbase}"
PB_DATA="${PB_DATA:-/var/lib/language-school/pb_data}"
PB_URL="${PB_URL:-http://127.0.0.1:8090}"
SERVICE="${SERVICE:-language-school-pocketbase.service}"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

for command in curl jq systemctl journalctl; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

if [[ ! -x "$PB_BIN" ]]; then
  echo "PocketBase binary not found: $PB_BIN" >&2
  exit 1
fi

read -r -p 'PocketBase superuser email: ' SUPERUSER_EMAIL
read -r -s -p 'PocketBase superuser password: ' SUPERUSER_PASSWORD
echo
read -r -p 'Application ADMIN email: ' ADMIN_EMAIL
read -r -p 'ADMIN name: ' ADMIN_NAME
read -r -p 'ADMIN surname: ' ADMIN_SURNAME
read -r -s -p 'Application ADMIN password (min 8 chars): ' ADMIN_PASSWORD
echo

if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
  echo 'Application ADMIN password must have at least 8 characters.' >&2
  exit 1
fi

if [[ ${#SUPERUSER_PASSWORD} -lt 10 ]]; then
  echo 'Use a stronger PocketBase superuser password (at least 10 characters).' >&2
  exit 1
fi

systemctl stop "$SERVICE" 2>/dev/null || true
"$PB_BIN" superuser create "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD" --dir="$PB_DATA"
systemctl start "$SERVICE"

for attempt in {1..30}; do
  if curl -fsS "$PB_URL/api/health" >/dev/null; then
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo 'PocketBase did not become healthy.' >&2
    journalctl -u "$SERVICE" -n 80 --no-pager >&2 || true
    exit 1
  fi
  sleep 1
done

SUPER_AUTH="$(curl -fsS -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg identity "$SUPERUSER_EMAIL" --arg password "$SUPERUSER_PASSWORD" '{identity:$identity,password:$password}')")"
SUPER_TOKEN="$(jq -r '.token' <<<"$SUPER_AUTH")"

ADMIN_PAYLOAD="$(jq -nc \
  --arg email "$ADMIN_EMAIL" \
  --arg password "$ADMIN_PASSWORD" \
  --arg name "$ADMIN_NAME" \
  --arg surname "$ADMIN_SURNAME" \
  '{email:$email,password:$password,passwordConfirm:$password,name:$name,surname:$surname,role:"ADMIN",status:"ACTIVE",phone:""}')"

ADMIN_RECORD="$(curl -fsS -X POST "$PB_URL/api/collections/users/records" \
  -H 'Content-Type: application/json' \
  -H "Authorization: $SUPER_TOKEN" \
  --data "$ADMIN_PAYLOAD")"

ADMIN_ID="$(jq -r '.id' <<<"$ADMIN_RECORD")"
if [[ -z "$ADMIN_ID" || "$ADMIN_ID" == 'null' ]]; then
  echo 'Application ADMIN creation failed.' >&2
  exit 1
fi

unset SUPERUSER_PASSWORD ADMIN_PASSWORD SUPER_TOKEN SUPER_AUTH ADMIN_PAYLOAD

echo "Application ADMIN created successfully: $ADMIN_EMAIL"
echo "Record ID: $ADMIN_ID"
echo 'Keep the PocketBase superuser credentials offline; normal academy administration uses the ADMIN account.'
