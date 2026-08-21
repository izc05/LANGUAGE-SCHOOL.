#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="${ADMIN_EMAIL:-ci-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-CiAdminPass123!}"
SUPERUSER_EMAIL="${PB_SUPERUSER_EMAIL:-ci-superuser@example.com}"
SUPERUSER_PASSWORD="${PB_SUPERUSER_PASSWORD:-CiSuperuserPass123!}"
INVITED_ADMIN_EMAIL="ci-invited-admin@example.com"
INVITED_ADMIN_PASSWORD="CiInvitedAdminOwnPass123!"
OLD_TOKEN='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
NEW_TOKEN='BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

raw_auth() {
  local collection="$1" email="$2" password="$3" output="$4"
  curl -sS -o "$output" -w '%{http_code}' \
    -X POST "$PB_URL/api/collections/$collection/auth-with-password" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg identity "$email" --arg password "$password" '{identity:$identity,password:$password}')"
}

set_test_invitation_token() {
  local invitation_id="$1" token="$2" hash
  hash="$(printf '%s' "$token" | sha256sum | awk '{print $1}')"
  curl -fsS -X PATCH "$PB_URL/api/collections/account_invitations/records/$invitation_id" \
    -H "Authorization: $SUPER_TOKEN" -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg tokenHash "$hash" '{token_hash:$tokenHash}')" >/dev/null
}

ADMIN_BODY="$(mktemp)"
SUPER_BODY="$(mktemp)"
INVITED_LOGIN_BODY="$(mktemp)"
ACTIVE_LOGIN_BODY="$(mktemp)"
PATCH_BODY="$(mktemp)"
trap 'rm -f "$ADMIN_BODY" "$SUPER_BODY" "$INVITED_LOGIN_BODY" "$ACTIVE_LOGIN_BODY" "$PATCH_BODY"' EXIT

echo '1/13 Authenticate existing application ADMIN and CI superuser'
test "$(raw_auth 'users' "$ADMIN_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_BODY")" = '200'
ADMIN_TOKEN="$(jq -r '.token' "$ADMIN_BODY")"
test -n "$ADMIN_TOKEN" && test "$ADMIN_TOKEN" != 'null'
test "$(raw_auth '_superusers' "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD" "$SUPER_BODY")" = '200'
SUPER_TOKEN="$(jq -r '.token' "$SUPER_BODY")"
test -n "$SUPER_TOKEN" && test "$SUPER_TOKEN" != 'null'

echo '2/13 Invite a new ADMIN without choosing their password or receiving the activation secret'
INVITE="$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg email "$INVITED_ADMIN_EMAIL" '{role:"ADMIN",email:$email,name:"CI",surname:"Invited Admin",phone:"",activationBaseUrl:"http://127.0.0.1:4173"}')")"
ADMIN_ID="$(jq -r '.userId' <<<"$INVITE")"
OLD_INVITATION_ID="$(jq -r '.invitationId' <<<"$INVITE")"
test "$(jq -r '.role' <<<"$INVITE")" = 'ADMIN'
test "$(jq -r '.activationUrl' <<<"$INVITE")" = ''
test -n "$ADMIN_ID" && test -n "$OLD_INVITATION_ID"
set_test_invitation_token "$OLD_INVITATION_ID" "$OLD_TOKEN"

ADMIN_RECORD="$(curl -fsS "$PB_URL/api/collections/users/records/$ADMIN_ID" -H "Authorization: $SUPER_TOKEN")"
test "$(jq -r '.role' <<<"$ADMIN_RECORD")" = 'ADMIN'
test "$(jq -r '.status' <<<"$ADMIN_RECORD")" = 'INVITED'
test "$(jq -r '.verified' <<<"$ADMIN_RECORD")" = 'false'
echo 'OK: ADMIN starts INVITED + unverified and the inviter receives no activation token'

echo '3/13 ADMIN invitation creates no academic profile'
STUDENT_PROFILE_COUNT="$(curl -fsS -G "$PB_URL/api/collections/student_profiles/records" -H "Authorization: $SUPER_TOKEN" --data-urlencode "filter=user = \"$ADMIN_ID\"" | jq -r '.totalItems')"
TEACHER_PROFILE_COUNT="$(curl -fsS -G "$PB_URL/api/collections/teacher_profiles/records" -H "Authorization: $SUPER_TOKEN" --data-urlencode "filter=user = \"$ADMIN_ID\"" | jq -r '.totalItems')"
test "$STUDENT_PROFILE_COUNT" = '0'
test "$TEACHER_PROFILE_COUNT" = '0'
echo 'OK: ADMIN has no student/teacher profile'

echo '4/13 INVITED ADMIN cannot authenticate with a guessed password'
INVITED_STATUS="$(raw_auth 'users' "$INVITED_ADMIN_EMAIL" 'GuessAdminPass123!' "$INVITED_LOGIN_BODY")"
if [[ "$INVITED_STATUS" == '200' || "$INVITED_STATUS" == '401' ]]; then
  echo "INVITED ADMIN must not begin authentication before activation (got HTTP $INVITED_STATUS)." >&2
  cat "$INVITED_LOGIN_BODY" >&2
  exit 1
fi
echo 'OK: INVITED ADMIN is non-authenticable'

echo '5/13 Resend rotates the ADMIN invitation while keeping its secret email-only'
RESENT="$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/resend" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg userId "$ADMIN_ID" '{userId:$userId,activationBaseUrl:"http://127.0.0.1:4173"}')")"
NEW_INVITATION_ID="$(jq -r '.invitationId' <<<"$RESENT")"
test "$(jq -r '.activationUrl' <<<"$RESENT")" = ''
test -n "$NEW_INVITATION_ID"
test "$NEW_INVITATION_ID" != "$OLD_INVITATION_ID"
set_test_invitation_token "$NEW_INVITATION_ID" "$NEW_TOKEN"
OLD_STATUS="$(curl -sS -o /tmp/admin-old-invite.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg token "$OLD_TOKEN" --arg password "$INVITED_ADMIN_PASSWORD" '{token:$token,password:$password,passwordConfirm:$password}')")"
test "$OLD_STATUS" = '400'
echo 'OK: resend invalidates the previous token and never exposes the replacement'

echo '6/13 Invited ADMIN chooses their own password through the one-use secret'
ACTIVATE_STATUS="$(curl -sS -o /tmp/admin-activate.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg token "$NEW_TOKEN" --arg password "$INVITED_ADMIN_PASSWORD" '{token:$token,password:$password,passwordConfirm:$password}')")"
test "$ACTIVATE_STATUS" = '200'
ACTIVE_RECORD="$(curl -fsS "$PB_URL/api/collections/users/records/$ADMIN_ID" -H "Authorization: $SUPER_TOKEN")"
test "$(jq -r '.status' <<<"$ACTIVE_RECORD")" = 'ACTIVE'
test "$(jq -r '.verified' <<<"$ACTIVE_RECORD")" = 'true'
echo 'OK: ADMIN activation moves INVITED -> ACTIVE + verified'

echo '7/13 Activated ADMIN password alone receives MFA challenge, never a token'
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

echo '8/13 Existing ADMIN cannot replace another ADMIN password'
PATCH_STATUS="$(curl -sS -o "$PATCH_BODY" -w '%{http_code}' -X PATCH "$PB_URL/api/collections/users/records/$ADMIN_ID" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"password":"ForgedAdminPass123!","passwordConfirm":"ForgedAdminPass123!"}')"
test "$PATCH_STATUS" = '400'
grep -qi 'otro administrador' "$PATCH_BODY"
echo 'OK: admin-to-admin password mutation is blocked server-side'

echo '9/13 Existing ADMIN cannot change another ADMIN verification credential'
VERIFIED_STATUS="$(curl -sS -o "$PATCH_BODY" -w '%{http_code}' -X PATCH "$PB_URL/api/collections/users/records/$ADMIN_ID" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"verified":false}')"
test "$VERIFIED_STATUS" = '400'
echo 'OK: admin-to-admin verified mutation is blocked server-side'

echo '10/13 Existing ADMIN cannot redirect another ADMIN security email'
EMAIL_STATUS="$(curl -sS -o "$PATCH_BODY" -w '%{http_code}' -X PATCH "$PB_URL/api/collections/users/records/$ADMIN_ID" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"email":"hijacked-admin@example.com"}')"
test "$EMAIL_STATUS" = '400'
UNCHANGED_RECORD="$(curl -fsS "$PB_URL/api/collections/users/records/$ADMIN_ID" -H "Authorization: $SUPER_TOKEN")"
test "$(jq -r '.email' <<<"$UNCHANGED_RECORD")" = "$INVITED_ADMIN_EMAIL"
echo 'OK: admin-to-admin email mutation is blocked and MFA destination is unchanged'

echo '11/13 Existing ADMIN cannot change another ADMIN lifecycle state via generic API'
STATE_STATUS="$(curl -sS -o "$PATCH_BODY" -w '%{http_code}' -X PATCH "$PB_URL/api/collections/users/records/$ADMIN_ID" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"status":"SUSPENDED"}')"
test "$STATE_STATUS" = '400'
UNCHANGED_RECORD="$(curl -fsS "$PB_URL/api/collections/users/records/$ADMIN_ID" -H "Authorization: $SUPER_TOKEN")"
test "$(jq -r '.status' <<<"$UNCHANGED_RECORD")" = 'ACTIVE'
echo 'OK: admin-to-admin status mutation is blocked'

echo '12/13 Existing ADMIN cannot delete another ADMIN via generic users API'
DELETE_STATUS="$(curl -sS -o "$PATCH_BODY" -w '%{http_code}' -X DELETE "$PB_URL/api/collections/users/records/$ADMIN_ID" \
  -H "Authorization: $ADMIN_TOKEN")"
test "$DELETE_STATUS" = '403'
STILL_EXISTS="$(curl -fsS "$PB_URL/api/collections/users/records/$ADMIN_ID" -H "Authorization: $SUPER_TOKEN")"
test "$(jq -r '.id' <<<"$STILL_EXISTS")" = "$ADMIN_ID"
echo 'OK: ADMIN deletion is blocked outside a dedicated auditable flow'

echo '13/13 Activation token remains one-use'
REUSE_STATUS="$(curl -sS -o /tmp/admin-reuse.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "$(jq -nc --arg token "$NEW_TOKEN" --arg password 'AnotherAdminPass123!' '{token:$token,password:$password,passwordConfirm:$password}')")"
test "$REUSE_STATUS" = '400'
echo 'ADMIN ACCOUNT INVITATION SECURITY SMOKE TEST: SUCCESS'
