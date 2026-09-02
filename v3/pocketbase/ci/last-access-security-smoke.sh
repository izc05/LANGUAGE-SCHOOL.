#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
SUPERUSER_EMAIL="${PB_SUPERUSER_EMAIL:-ci-superuser@example.com}"
SUPERUSER_PASSWORD="${PB_SUPERUSER_PASSWORD:-CiSuperuserPass123!}"
ADMIN_EMAIL="ci-admin@example.com"
ADMIN_PASSWORD="CiAdminPass123!"
STUDENT_EMAIL="ci-last-access@example.com"
STUDENT_PASSWORD="CiLastAccessPass123!"

auth() {
  curl -fsS -X POST "$PB_URL/api/collections/$1/auth-with-password" -H 'Content-Type: application/json' --data "$(jq -nc --arg identity "$2" --arg password "$3" '{identity:$identity,password:$password}')"
}

super_auth() {
  auth '_superusers' "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD"
}

fail() { echo "ASSERTION FAILED: $1" >&2; exit 1; }

echo '1/5 Authenticate application ADMIN and create an isolated active student'
ADMIN_TOKEN="$(jq -r '.token' <<<"$(auth 'users' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")")"
SUPER_TOKEN="$(jq -r '.token' <<<"$(super_auth)")"
STUDENT="$(curl -fsS -X POST "$PB_URL/api/collections/users/records" -H 'Content-Type: application/json' -H "Authorization: $SUPER_TOKEN" --data "$(jq -nc --arg email "$STUDENT_EMAIL" --arg password "$STUDENT_PASSWORD" '{email:$email,password:$password,passwordConfirm:$password,name:"CI",surname:"Last access",role:"STUDENT",status:"ACTIVE",verified:true,phone:""}')")"
STUDENT_ID="$(jq -r '.id' <<<"$STUDENT")"

echo '2/5 Successful student authentication records access server-side'
STUDENT_AUTH="$(auth 'users' "$STUDENT_EMAIL" "$STUDENT_PASSWORD")"
STUDENT_TOKEN="$(jq -r '.token' <<<"$STUDENT_AUTH")"
test -n "$STUDENT_TOKEN" && test "$STUDENT_TOKEN" != 'null'

echo '3/5 Student authentication response does not expose last access'
jq -e '.record | has("last_access_at") | not' <<<"$STUDENT_AUTH" >/dev/null || fail 'student auth response exposes last_access_at'

echo '4/5 ADMIN can read the recorded operational timestamp'
ADMIN_VIEW="$(curl -fsS "$PB_URL/api/collections/users/records/$STUDENT_ID" -H "Authorization: $ADMIN_TOKEN")"
jq -e '.last_access_at | strings | length > 0' <<<"$ADMIN_VIEW" >/dev/null || fail 'ADMIN cannot read last_access_at'

echo '5/5 Student cannot forge last access'
STATUS="$(curl -sS -o /dev/null -w '%{http_code}' -X PATCH "$PB_URL/api/collections/users/records/$STUDENT_ID" -H 'Content-Type: application/json' -H "Authorization: $STUDENT_TOKEN" --data '{"last_access_at":"2099-01-01 00:00:00.000Z"}')"
case "$STATUS" in 400|401|403|404) echo "OK: student last_access_at update denied with HTTP $STATUS" ;; *) fail "student updated last_access_at with HTTP $STATUS" ;; esac

echo 'LAST ACCESS SECURITY SMOKE TEST: SUCCESS'
