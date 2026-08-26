#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="${ADMIN_EMAIL:-ci-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-CiAdminPass123!}"
SUPERUSER_EMAIL="${PB_SUPERUSER_EMAIL:-ci-superuser@example.com}"
SUPERUSER_PASSWORD="${PB_SUPERUSER_PASSWORD:-CiSuperuserPass123!}"

expect_status() {
  local expected="$1" actual="$2" label="$3"
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $label expected HTTP $expected, got $actual" >&2
    exit 1
  fi
  echo "OK: $label"
}

json_field() {
  local payload="$1" field="$2"
  printf '%s' "$payload" | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get(sys.argv[1], ""))' "$field"
}

record_field() {
  local collection="$1" id="$2" field="$3"
  curl -fsS "$PB_URL/api/collections/$collection/records/$id" \
    -H "Authorization: $SUPER_TOKEN" \
    | python3 -c 'import json,sys; data=json.load(sys.stdin); print(data.get(sys.argv[1], ""))' "$field"
}

echo "1/12 Authenticate application ADMIN and CI superuser"
ADMIN_AUTH=$(curl -fsS -X POST "$PB_URL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(printf '%s' "$ADMIN_AUTH" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
SUPER_AUTH=$(curl -fsS -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "{\"identity\":\"$SUPERUSER_EMAIL\",\"password\":\"$SUPERUSER_PASSWORD\"}")
SUPER_TOKEN=$(printf '%s' "$SUPER_AUTH" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

echo "2/12 Invite STUDENT without exposing the private activation link"
INVITE=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"role":"STUDENT","email":"ci-invited-student@example.com","name":"Invite","surname":"Student","phone":"","birthDate":"","guardianName":"","guardianPhone":"","activationBaseUrl":"http://127.0.0.1:4173"}')
STUDENT_ID=$(json_field "$INVITE" userId)
STUDENT_INVITATION_ID=$(json_field "$INVITE" invitationId)
STUDENT_URL=$(json_field "$INVITE" activationUrl)
[ -n "$STUDENT_ID" ] || { echo "FAIL: missing invited student id" >&2; exit 1; }
[ -n "$STUDENT_INVITATION_ID" ] || { echo "FAIL: missing server-side invitation id" >&2; exit 1; }
[ -z "$STUDENT_URL" ] || { echo "FAIL: Admin response must not expose student activation URL" >&2; exit 1; }
STUDENT_HASH=$(record_field account_invitations "$STUDENT_INVITATION_ID" token_hash)
[ ${#STUDENT_HASH} -eq 64 ] || { echo "FAIL: invitation must persist only a SHA-256 token hash" >&2; exit 1; }
STUDENT_RECORD=$(curl -fsS "$PB_URL/api/collections/users/records/$STUDENT_ID" -H "Authorization: $ADMIN_TOKEN")
[ "$(json_field "$STUDENT_RECORD" status)" = "INVITED" ] || { echo "FAIL: student must be INVITED" >&2; exit 1; }
[ "$(printf '%s' "$STUDENT_RECORD" | python3 -c 'import json,sys; print(str(json.load(sys.stdin)["verified"]).lower())')" = "false" ] || { echo "FAIL: invited student must be unverified" >&2; exit 1; }
echo "OK: raw student token is server-only and the account remains INVITED"

echo "3/12 Guessed password cannot authenticate INVITED account"
STATUS=$(curl -sS -o /tmp/invite-login.json -w '%{http_code}' -X POST "$PB_URL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data '{"identity":"ci-invited-student@example.com","password":"GuessPass123!"}')
expect_status 400 "$STATUS" "INVITED account rejects password auth"

echo "4/12 Invitation status is PENDING without revealing secret material"
STATUS_BODY=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/status" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$STUDENT_ID\"}")
[ "$(json_field "$STATUS_BODY" invitationStatus)" = "PENDING" ] || { echo "FAIL: invitation status should be PENDING" >&2; exit 1; }
printf '%s' "$STATUS_BODY" | python3 -c 'import json,sys; data=json.load(sys.stdin); forbidden=[k for k in data if "token" in k.lower() or "activationurl" in k.lower()]; assert not forbidden, f"secret-like fields exposed: {forbidden}"' 
echo "OK: Admin can inspect lifecycle state but not token/link"

echo "5/12 Invalid activation token is rejected"
BAD_STATUS=$(curl -sS -o /tmp/bad-activation.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data '{"token":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","password":"OwnerPass123!","passwordConfirm":"OwnerPass123!"}')
expect_status 400 "$BAD_STATUS" "invalid activation token rejected"

echo "6/12 Resend rotates STUDENT token server-side and revokes the previous invitation"
STUDENT_RESENT=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/resend" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$STUDENT_ID\",\"activationBaseUrl\":\"http://127.0.0.1:4173\"}")
STUDENT_NEW_INVITATION_ID=$(json_field "$STUDENT_RESENT" invitationId)
STUDENT_NEW_URL=$(json_field "$STUDENT_RESENT" activationUrl)
[ -z "$STUDENT_NEW_URL" ] || { echo "FAIL: resend must not expose student activation URL" >&2; exit 1; }
[ "$STUDENT_NEW_INVITATION_ID" != "$STUDENT_INVITATION_ID" ] || { echo "FAIL: resend must create a new invitation record" >&2; exit 1; }
STUDENT_NEW_HASH=$(record_field account_invitations "$STUDENT_NEW_INVITATION_ID" token_hash)
[ "$STUDENT_NEW_HASH" != "$STUDENT_HASH" ] || { echo "FAIL: resend must rotate the token hash" >&2; exit 1; }
[ "$(record_field account_invitations "$STUDENT_INVITATION_ID" status)" = "REVOKED" ] || { echo "FAIL: previous student invitation must be revoked" >&2; exit 1; }
[ "$(record_field account_invitations "$STUDENT_NEW_INVITATION_ID" status)" = "PENDING" ] || { echo "FAIL: replacement student invitation must be pending" >&2; exit 1; }
echo "OK: student resend rotates secrets without exposing either token"

echo "7/12 Revocation closes current STUDENT invitation"
curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/revoke" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$STUDENT_ID\"}" >/dev/null
[ "$(record_field account_invitations "$STUDENT_NEW_INVITATION_ID" status)" = "REVOKED" ] || { echo "FAIL: current student invitation must be revoked" >&2; exit 1; }
STUDENT_REVOKED_STATE=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/status" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$STUDENT_ID\"}")
[ "$(json_field "$STUDENT_REVOKED_STATE" invitationStatus)" = "REVOKED" ] || { echo "FAIL: revoked invitation should be reported REVOKED" >&2; exit 1; }
echo "OK: student invitation can be revoked without revealing its secret"

echo "8/12 Invite TEACHER through the same private-delivery contract"
TEACHER_INVITE=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"role":"TEACHER","email":"ci-invited-teacher@example.com","name":"Invite","surname":"Teacher","phone":"","bio":"CI invitation","specialties":["B1"],"publicProfile":false,"activationBaseUrl":"http://127.0.0.1:4173"}')
TEACHER_ID=$(json_field "$TEACHER_INVITE" userId)
TEACHER_INVITATION_ID=$(json_field "$TEACHER_INVITE" invitationId)
TEACHER_URL=$(json_field "$TEACHER_INVITE" activationUrl)
[ -z "$TEACHER_URL" ] || { echo "FAIL: Admin response must not expose teacher activation URL" >&2; exit 1; }
TEACHER_HASH=$(record_field account_invitations "$TEACHER_INVITATION_ID" token_hash)
[ ${#TEACHER_HASH} -eq 64 ] || { echo "FAIL: teacher invitation must persist only a token hash" >&2; exit 1; }
TEACHER_PROFILE=$(curl -fsS "$PB_URL/api/collections/teacher_profiles/records?filter=user%3D%22$TEACHER_ID%22" -H "Authorization: $SUPER_TOKEN")
[ "$(printf '%s' "$TEACHER_PROFILE" | python3 -c 'import json,sys; print(str(json.load(sys.stdin)["items"][0]["active"]).lower())')" = "false" ] || { echo "FAIL: invited teacher profile must stay inactive" >&2; exit 1; }
echo "OK: teacher invitation also keeps raw token out of Admin"

echo "9/12 Resend rotates TEACHER token and invalidates the previous invitation"
TEACHER_RESENT=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/resend" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$TEACHER_ID\",\"activationBaseUrl\":\"http://127.0.0.1:4173\"}")
TEACHER_NEW_INVITATION_ID=$(json_field "$TEACHER_RESENT" invitationId)
TEACHER_NEW_URL=$(json_field "$TEACHER_RESENT" activationUrl)
[ -z "$TEACHER_NEW_URL" ] || { echo "FAIL: resend must not expose teacher activation URL" >&2; exit 1; }
TEACHER_NEW_HASH=$(record_field account_invitations "$TEACHER_NEW_INVITATION_ID" token_hash)
[ "$TEACHER_NEW_HASH" != "$TEACHER_HASH" ] || { echo "FAIL: teacher resend must rotate token hash" >&2; exit 1; }
[ "$(record_field account_invitations "$TEACHER_INVITATION_ID" status)" = "REVOKED" ] || { echo "FAIL: old teacher invitation must be revoked" >&2; exit 1; }
echo "OK: teacher resend rotates token server-side"

echo "10/12 Teacher revocation is reflected in lifecycle status"
curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/revoke" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$TEACHER_ID\"}" >/dev/null
TEACHER_STATE=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/status" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$TEACHER_ID\"}")
[ "$(json_field "$TEACHER_STATE" invitationStatus)" = "REVOKED" ] || { echo "FAIL: teacher invitation should be REVOKED" >&2; exit 1; }
echo "OK: teacher invitation lifecycle remains manageable without raw token"

echo "11/12 Expired invitation is reported EXPIRED without exposing its token"
EXPIRED_INVITE=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"role":"STUDENT","email":"ci-expired-invite@example.com","name":"Expired","surname":"Invite","activationBaseUrl":"http://127.0.0.1:4173"}')
EXPIRED_USER_ID=$(json_field "$EXPIRED_INVITE" userId)
EXPIRED_INVITATION_ID=$(json_field "$EXPIRED_INVITE" invitationId)
[ -z "$(json_field "$EXPIRED_INVITE" activationUrl)" ] || { echo "FAIL: expired-case invite must not expose activation URL" >&2; exit 1; }
curl -fsS -X PATCH "$PB_URL/api/collections/account_invitations/records/$EXPIRED_INVITATION_ID" \
  -H "Authorization: $SUPER_TOKEN" -H 'Content-Type: application/json' \
  --data '{"expires_at":"2020-01-01T00:00:00.000Z"}' >/dev/null
EXPIRED_STATE=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/status" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$EXPIRED_USER_ID\"}")
[ "$(json_field "$EXPIRED_STATE" invitationStatus)" = "EXPIRED" ] || { echo "FAIL: expired invitation should be reported EXPIRED" >&2; exit 1; }
echo "OK: expiration is visible without raw activation material"

echo "12/12 Invitation records are not readable with normal ADMIN API token"
LOCKED_STATUS=$(curl -sS -o /tmp/locked-invitations.json -w '%{http_code}' \
  "$PB_URL/api/collections/account_invitations/records" -H "Authorization: $ADMIN_TOKEN")
if [ "$LOCKED_STATUS" != "403" ] && [ "$LOCKED_STATUS" != "404" ]; then
  echo "FAIL: invitation collection should be API-locked, got HTTP $LOCKED_STATUS" >&2
  cat /tmp/locked-invitations.json >&2 || true
  exit 1
fi
echo "OK: token hashes stay server-only; raw activation tokens are exercised only through the SMTP-backed E2E flow"
echo "ACCOUNT INVITATION SMOKE TEST: SUCCESS"