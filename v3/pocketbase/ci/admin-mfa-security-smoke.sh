#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
SUPERUSER_EMAIL="${PB_SUPERUSER_EMAIL:-ci-superuser@example.com}"
SUPERUSER_PASSWORD="${PB_SUPERUSER_PASSWORD:-CiSuperuserPass123!}"
MFA_ADMIN_EMAIL="ci-mfa-required-admin@example.com"
MFA_ADMIN_PASSWORD="CiMfaAdminPass123!"
NON_ADMIN_EMAIL="ci-mfa-non-admin@example.com"
NON_ADMIN_PASSWORD="CiMfaTeacherPass123!"

authenticate_raw() {
  local collection="$1" email="$2" password="$3" output="$4"
  curl -sS -o "$output" -w '%{http_code}' \
    -X POST "$PB_URL/api/collections/$collection/auth-with-password" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg identity "$email" --arg password "$password" '{identity:$identity,password:$password}')"
}

SUPER_BODY="$(mktemp)"
ADMIN_BODY="$(mktemp)"
TEACHER_BODY="$(mktemp)"
trap 'rm -f "$SUPER_BODY" "$ADMIN_BODY" "$TEACHER_BODY"' EXIT

SUPER_STATUS="$(authenticate_raw '_superusers' "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD" "$SUPER_BODY")"
test "$SUPER_STATUS" = '200'
SUPER_TOKEN="$(jq -r '.token' "$SUPER_BODY")"
test -n "$SUPER_TOKEN" && test "$SUPER_TOKEN" != 'null'

COLLECTION="$(curl -fsS "$PB_URL/api/collections/users" -H "Authorization: $SUPER_TOKEN")"
jq -e '.mfa.enabled == true' <<<"$COLLECTION" >/dev/null
jq -e '.mfa.duration == 900' <<<"$COLLECTION" >/dev/null
jq -e '.otp.enabled == true' <<<"$COLLECTION" >/dev/null
jq -e '.otp.duration == 300' <<<"$COLLECTION" >/dev/null
jq -e '.otp.length == 6' <<<"$COLLECTION" >/dev/null
jq -e '.mfa.rule | contains("role = \"ADMIN\"")' <<<"$COLLECTION" >/dev/null

echo 'OK: users auth collection exposes ADMIN MFA + 6 digit OTP contract'

ADMIN_RECORD="$(curl -fsS -X POST "$PB_URL/api/collections/users/records" \
  -H 'Content-Type: application/json' \
  -H "Authorization: $SUPER_TOKEN" \
  --data "$(jq -nc --arg email "$MFA_ADMIN_EMAIL" --arg password "$MFA_ADMIN_PASSWORD" '{email:$email,password:$password,passwordConfirm:$password,name:"CI",surname:"MFA Admin",role:"ADMIN",status:"ACTIVE",verified:true,phone:""}')")"
test "$(jq -r '.role' <<<"$ADMIN_RECORD")" = 'ADMIN'

ADMIN_STATUS="$(authenticate_raw 'users' "$MFA_ADMIN_EMAIL" "$MFA_ADMIN_PASSWORD" "$ADMIN_BODY")"
if [[ "$ADMIN_STATUS" != '401' ]]; then
  echo "Expected ADMIN password-only authentication to return 401 MFA challenge, got $ADMIN_STATUS" >&2
  cat "$ADMIN_BODY" >&2
  exit 1
fi

MFA_ID="$(jq -r '.mfaId // empty' "$ADMIN_BODY")"
test -n "$MFA_ID"
if jq -e '.token != null and .token != ""' "$ADMIN_BODY" >/dev/null 2>&1; then
  echo 'ADMIN received a token before completing MFA.' >&2
  exit 1
fi

echo 'OK: ADMIN password alone yields mfaId and no auth token'

curl -fsS -X POST "$PB_URL/api/collections/users/records" \
  -H 'Content-Type: application/json' \
  -H "Authorization: $SUPER_TOKEN" \
  --data "$(jq -nc --arg email "$NON_ADMIN_EMAIL" --arg password "$NON_ADMIN_PASSWORD" '{email:$email,password:$password,passwordConfirm:$password,name:"CI",surname:"MFA Teacher",role:"TEACHER",status:"ACTIVE",verified:true,phone:""}')" >/dev/null

TEACHER_STATUS="$(authenticate_raw 'users' "$NON_ADMIN_EMAIL" "$NON_ADMIN_PASSWORD" "$TEACHER_BODY")"
if [[ "$TEACHER_STATUS" != '200' ]]; then
  echo "Expected non-ADMIN password authentication to remain unchanged, got $TEACHER_STATUS" >&2
  cat "$TEACHER_BODY" >&2
  exit 1
fi
jq -e '.token | type == "string" and length > 20' "$TEACHER_BODY" >/dev/null
jq -e '.record.role == "TEACHER"' "$TEACHER_BODY" >/dev/null

echo 'OK: TEACHER password login remains single-factor'
