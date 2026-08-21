#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="${ADMIN_EMAIL:-ci-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-CiAdminPass123!}"
SUPERUSER_EMAIL="${PB_SUPERUSER_EMAIL:-ci-superuser@example.com}"
SUPERUSER_PASSWORD="${PB_SUPERUSER_PASSWORD:-CiSuperuserPass123!}"
INVITED_ADMIN_EMAIL="ci-invited-admin@example.com"
INVITED_ADMIN_PASSWORD="CiInvitedAdminOwnPass123!"

raw_auth() {
  local collection="$1" email="$2" password="$3" output="$4"
  curl -sS -o "$output" -w '%{http_code}' \
    -X POST "$PB_URL/api/collections/$collection/auth-with-password" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg identity "$email" --arg password "$password" '{identity:$identity,password:$password}')"
}

ADMIN_BODY="$(mktemp)"
SUPER_BODY="$(mktemp)"
INVITED_LOGIN_BODY="$(mktemp)"
ACTIVE_LOGIN_BODY="$(mktemp)"
PATCH_BODY="$(mktemp)"
trap 'rm -f "$ADMIN_BODY" "$SUPER_BODY" "$INVITED_LOGIN_BODY" "$ACTIVE_LOGIN_BODY" "$PATCH_BODY"' EXIT

echo '1/10 Authenticate existing application ADMIN and CI superuser'
test "$(raw_auth 'users' "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_BODY")" = '200'
ADMIN_TOKEN="$(jq -r '.token' "$ADMIN_BODY")"
test -n "$ADMIN_TOKEN" && test "$ADMIN_TOKEN" != 'null'
test "$(raw_auth '_superusers' "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD" "$SUPER_BODY")" = '200'
SUPER_TOKEN="$(jq -r '.token' "$SUPER_BODY")"
test -n "$SUPER_TOKEN" && test "$SUPER_TOKEN" != 'null'

echo '2/10 Invite a new ADMIN without choosing their password'
INVITE="$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg email "$INVITED_ADMIN_EMAIL" '{role:"ADMIN",email:$email,name:"CI",surname:"Invited Admin",phone:"",activationBaseUrl:"http://127.0.0.1:4173"}')")"
ADMIN_ID="$(jq -r '.userId' <<<"$INVITE")"
OLD_URL="$(jq -r '.activationUrl' <<<"$INVITE")"
OLD_TOKEN="${OLD_URL##*token=}"
test "$(jq -r '.role' <<<"$INVITE")" = 'ADMIN'
test -n "$ADMIN_ID" && test -n "$OLD_TOKEN"

ADMIN_RECORD="$(curl -fsS "$PB_URL/api/collections/users/records/$ADMIN_ID" -H "Authorization: $SUPER_TOKEN")"
test "$(jq -r '.role' <<<"$ADMIN_RECORD")" = 'ADMIN'
test "$(jq -r '.status' <<<"$ADMIN_RECORD")" = 'INVITED'
test "$(jq -r '.verified' <<<"$ADMIN_RECORD")" = 'false'
echo 'OK: ADMIN starts INVITED + unverified with a random server-side password'

echo '3/10 ADMIN invitation creates no academic profile'
STUDENT_PROFILE_COUNT="$(curl -fsS -G "$PB_URL/api/collections/student_profiles/records" -H "Authorization: $SUPER_TOKEN" --data-urlencode "filter=user = \"$ADMIN_ID\"" | jq -r '.totalItems')"
TEACHER_PROFILE_COUNT="$(curl -fsS -G "$PB_URL/api/collections/teacher_profiles/records" -H "Authorization: $SUPER_TOKEN" --data-urlencode "filter=user = \"$ADMIN_ID\"" | jq -r '.totalItems')"
test "$STUDENT_PROFILE_COUNT" = '0'
test "$TEACHER_PROFILE_COUNT" = '0'
echo 'OK: ADMIN has no student/teacher profile'

echo '4/10 INVITED ADMIN cannot authenticate with a guessed password'
INVITED_STATUS="$(raw_auth 'users' "$INVITED_ADMIN_EMAIL" 'GuessAdminPass123!' "$INVITED_LOGIN_BODY")"
if [[ "$INVITED_STATUS" == '200' || "$INVITED_STATUS" == '401' ]]; then
  echo "INVITED ADMIN must not begin authentication before activation (got HTTP $INVITED_STATUS)." >&2
  cat "$INVITED_LOGIN_BODY" >&2
  exit 1
fi
echo 'OK: INVITED ADMIN is non-authenticable'

echo '5/10 Resend rotates the ADMIN activation token'
RESENT="$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/resend" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg userId "$ADMIN_ID" '{userId:$userId,activationBaseUrl:"http://127.0.0.1:4173"}')")"
NEW_URL="$(jq -r '.activationUrl' <<<"$RESENT")"
NEW_TOKEN="${NEW_URL##*token=}"
test -n "$NEW_TOKEN"
test "$NEW_TOKEN" != "$OLD_TOKEN"
OLD_STATUS="$(curl -sS -o /tmp/admin-old-invite.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg token "$OLD_TOKEN" --arg password "$INVITED_ADMIN_PASSWORD" '{token:$token,password:$password,passwordConfirm:$password}')")"
test "$OLD_STATUS" = '400'
echo 'OK: resend invalidates the previous ADMIN token'

echo '6/10 Invited ADMIN chooses their own password through the one-use link'
ACTIVATE_STATUS="$(curl -sS -o /tmp/admin-activate.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg token "$NEW_TOKEN" --arg password "$INVITED_ADMIN_PASSWORD" '{token:$token,password:$password,passwordConfirm:$password}')")"
test "$ACTIVATE_STATUS" = '200'
ACTIVE_RECORD="$(curl -fsS "$PB_URL/api/collections/users/records/$ADMIN_ID" -H "Authorization: $SUPER_TOKEN")"
test "$(jq -r '.status' <<<"$ACTIVE_RECORD")" = 'ACTIVE'
test "$(jq -r '.verified' <<<"$ACTIVE_RECORD")" = 'true'
echo 'OK: ADMIN activation moves INVITED -> ACTIVE + verified'

echo '7/10 Activated ADMIN password alone receives MFA challenge, never a token'
ACTIVE_STATUS="$(raw_auth 'users' "$INVITED_ADMIN_EMAIL" "$INVITED_ADMIN_PASSWORD" "$ACTIVE_LOGIN_BODY")"
if [[ "$ACTIVE_STATUS" != '401' ]]; then
  echo "Expected activated ADMIN login to require MFA (401), got $ACTIVE_STATUS" >&2
  cat "$ACTIVE_LOGIN_BODY" >&2
  exit 1
fi
test -n "$(jq -r '.mfaId // empty' "$ACTIVE_LOGIN_BODY")"
if jq -e '.token != null and .token != ""' "$ACTIVE_LOGIN_BODY" >/dev/null 2>&1; then
  echo 'Activated ADMIN received an auth token before MFA.' >&2
  exit 1
fi
echo 'OK: new ADMIN automatically inherits mandatory MFA'

echo '8/10 Existing ADMIN cannot replace another ADMIN password'
PATCH_STATUS="$(curl -sS -o "$PATCH_BODY" -w '%{http_code}' -X PATCH "$PB_URL/api/collections/users/records/$ADMIN_ID" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"password":"ForgedAdminPass123!","passwordConfirm":"ForgedAdminPass123!"}')"
test "$PATCH_STATUS" = '400'
grep -qi 'otro administrador' "$PATCH_BODY"
echo 'OK: admin-to-admin password mutation is blocked server-side'

echo '9/10 Existing ADMIN cannot change another ADMIN verification credential'
VERIFIED_STATUS="$(curl -sS -o "$PATCH_BODY" -w '%{http_code}' -X PATCH "$PB_URL/api/collections/users/records/$ADMIN_ID" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"verified":false}')"
test "$VERIFIED_STATUS" = '400'
echo 'OK: admin-to-admin verified mutation is blocked server-side'

echo '10/10 Activation token remains one-use'
REUSE_STATUS="$(curl -sS -o /tmp/admin-reuse.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg token "$NEW_TOKEN" --arg password 'AnotherAdminPass123!' '{token:$token,password:$password,passwordConfirm:$password}')")"
test "$REUSE_STATUS" = '400'
echo 'ADMIN ACCOUNT INVITATION SECURITY SMOKE TEST: SUCCESS'
