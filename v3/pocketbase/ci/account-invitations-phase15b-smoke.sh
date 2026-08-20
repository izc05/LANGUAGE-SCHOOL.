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

echo "1/12 Authenticate application ADMIN"
ADMIN_AUTH=$(curl -fsS -X POST "$PB_URL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(printf '%s' "$ADMIN_AUTH" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

echo "2/12 Invite STUDENT without an Admin-known password"
INVITE=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"role":"STUDENT","email":"ci-invited-student@example.com","name":"Invite","surname":"Student","phone":"","birthDate":"","guardianName":"","guardianPhone":"","activationBaseUrl":"http://127.0.0.1:4173"}')
STUDENT_ID=$(printf '%s' "$INVITE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["userId"])')
STUDENT_URL=$(printf '%s' "$INVITE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["activationUrl"])')
STUDENT_TOKEN="${STUDENT_URL##*token=}"
[ -n "$STUDENT_TOKEN" ] || { echo "FAIL: missing student activation token" >&2; exit 1; }

STUDENT_RECORD=$(curl -fsS "$PB_URL/api/collections/users/records/$STUDENT_ID" -H "Authorization: $ADMIN_TOKEN")
[ "$(printf '%s' "$STUDENT_RECORD" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')" = "INVITED" ] || { echo "FAIL: student must be INVITED" >&2; exit 1; }
[ "$(printf '%s' "$STUDENT_RECORD" | python3 -c 'import json,sys; print(str(json.load(sys.stdin)["verified"]).lower())')" = "false" ] || { echo "FAIL: invited student must be unverified" >&2; exit 1; }
echo "OK: invited student is non-authenticable"

echo "3/12 Guessed password cannot authenticate INVITED account"
STATUS=$(curl -sS -o /tmp/invite-login.json -w '%{http_code}' -X POST "$PB_URL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data '{"identity":"ci-invited-student@example.com","password":"GuessPass123!"}')
expect_status 400 "$STATUS" "INVITED account rejects password auth"

echo "4/12 Invitation status is PENDING"
STATUS_BODY=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/status" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$STUDENT_ID\"}")
[ "$(printf '%s' "$STATUS_BODY" | python3 -c 'import json,sys; print(json.load(sys.stdin)["invitationStatus"])')" = "PENDING" ] || { echo "FAIL: invitation status should be PENDING" >&2; exit 1; }
echo "OK: invitation status is visible to Admin"

echo "5/12 Invalid token is rejected"
BAD_STATUS=$(curl -sS -o /tmp/bad-activation.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data '{"token":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","password":"OwnerPass123!","passwordConfirm":"OwnerPass123!"}')
expect_status 400 "$BAD_STATUS" "invalid activation token rejected"

echo "6/12 Valid token activates account and owner chooses password"
ACTIVATE_STATUS=$(curl -sS -o /tmp/activate.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "{\"token\":\"$STUDENT_TOKEN\",\"password\":\"OwnerPass123!\",\"passwordConfirm\":\"OwnerPass123!\"}")
expect_status 200 "$ACTIVATE_STATUS" "student activation succeeds"
ACTIVE_RECORD=$(curl -fsS "$PB_URL/api/collections/users/records/$STUDENT_ID" -H "Authorization: $ADMIN_TOKEN")
[ "$(printf '%s' "$ACTIVE_RECORD" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')" = "ACTIVE" ] || { echo "FAIL: student should be ACTIVE" >&2; exit 1; }
[ "$(printf '%s' "$ACTIVE_RECORD" | python3 -c 'import json,sys; print(str(json.load(sys.stdin)["verified"]).lower())')" = "true" ] || { echo "FAIL: activated student should be verified" >&2; exit 1; }
echo "OK: activation moves INVITED -> ACTIVE + verified"

echo "7/12 Token is one-use and login works only with owner password"
REUSE_STATUS=$(curl -sS -o /tmp/reuse.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "{\"token\":\"$STUDENT_TOKEN\",\"password\":\"OtherPass123!\",\"passwordConfirm\":\"OtherPass123!\"}")
expect_status 400 "$REUSE_STATUS" "used token cannot be reused"
curl -fsS -X POST "$PB_URL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data '{"identity":"ci-invited-student@example.com","password":"OwnerPass123!"}' >/dev/null
echo "OK: activated owner password authenticates"

echo "8/12 Invite TEACHER and resend revokes previous token"
TEACHER_INVITE=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"role":"TEACHER","email":"ci-invited-teacher@example.com","name":"Invite","surname":"Teacher","phone":"","bio":"CI invitation","specialties":["B1"],"publicProfile":false,"activationBaseUrl":"http://127.0.0.1:4173"}')
TEACHER_ID=$(printf '%s' "$TEACHER_INVITE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["userId"])')
OLD_TEACHER_URL=$(printf '%s' "$TEACHER_INVITE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["activationUrl"])')
OLD_TEACHER_TOKEN="${OLD_TEACHER_URL##*token=}"
RESENT=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/resend" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$TEACHER_ID\",\"activationBaseUrl\":\"http://127.0.0.1:4173\"}")
NEW_TEACHER_URL=$(printf '%s' "$RESENT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["activationUrl"])')
NEW_TEACHER_TOKEN="${NEW_TEACHER_URL##*token=}"
[ "$OLD_TEACHER_TOKEN" != "$NEW_TEACHER_TOKEN" ] || { echo "FAIL: resend must rotate token" >&2; exit 1; }
OLD_STATUS=$(curl -sS -o /tmp/old-teacher-token.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "{\"token\":\"$OLD_TEACHER_TOKEN\",\"password\":\"TeacherPass123!\",\"passwordConfirm\":\"TeacherPass123!\"}")
expect_status 400 "$OLD_STATUS" "resend invalidates old token"

echo "9/12 Revocation blocks current token"
curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/revoke" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$TEACHER_ID\"}" >/dev/null
REVOKED_STATUS=$(curl -sS -o /tmp/revoked-token.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "{\"token\":\"$NEW_TEACHER_TOKEN\",\"password\":\"TeacherPass123!\",\"passwordConfirm\":\"TeacherPass123!\"}")
expect_status 400 "$REVOKED_STATUS" "revoked token cannot activate"

echo "10/12 Reissue after revoke and activate TEACHER"
TEACHER_FINAL=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/resend" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$TEACHER_ID\",\"activationBaseUrl\":\"http://127.0.0.1:4173\"}")
TEACHER_FINAL_URL=$(printf '%s' "$TEACHER_FINAL" | python3 -c 'import json,sys; print(json.load(sys.stdin)["activationUrl"])')
TEACHER_FINAL_TOKEN="${TEACHER_FINAL_URL##*token=}"
curl -fsS -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "{\"token\":\"$TEACHER_FINAL_TOKEN\",\"password\":\"TeacherPass123!\",\"passwordConfirm\":\"TeacherPass123!\"}" >/dev/null
curl -fsS -X POST "$PB_URL/api/collections/users/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data '{"identity":"ci-invited-teacher@example.com","password":"TeacherPass123!"}' >/dev/null
echo "OK: teacher uses the same invitation infrastructure"

echo "11/12 Expired invitation is rejected and reported EXPIRED"
EXPIRED_INVITE=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data '{"role":"STUDENT","email":"ci-expired-invite@example.com","name":"Expired","surname":"Invite","activationBaseUrl":"http://127.0.0.1:4173"}')
EXPIRED_USER_ID=$(printf '%s' "$EXPIRED_INVITE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["userId"])')
EXPIRED_INVITATION_ID=$(printf '%s' "$EXPIRED_INVITE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["invitationId"])')
EXPIRED_URL=$(printf '%s' "$EXPIRED_INVITE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["activationUrl"])')
EXPIRED_TOKEN="${EXPIRED_URL##*token=}"

SUPER_AUTH=$(curl -fsS -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  --data "{\"identity\":\"$SUPERUSER_EMAIL\",\"password\":\"$SUPERUSER_PASSWORD\"}")
SUPER_TOKEN=$(printf '%s' "$SUPER_AUTH" | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')
curl -fsS -X PATCH "$PB_URL/api/collections/account_invitations/records/$EXPIRED_INVITATION_ID" \
  -H "Authorization: $SUPER_TOKEN" -H 'Content-Type: application/json' \
  --data '{"expires_at":"2020-01-01T00:00:00.000Z"}' >/dev/null

EXPIRED_STATUS=$(curl -sS -o /tmp/expired-token.json -w '%{http_code}' -X POST "$PB_URL/api/language-school/account/activate" \
  -H 'Content-Type: application/json' \
  --data "{\"token\":\"$EXPIRED_TOKEN\",\"password\":\"ExpiredPass123!\",\"passwordConfirm\":\"ExpiredPass123!\"}")
expect_status 400 "$EXPIRED_STATUS" "expired token rejected"
EXPIRED_STATE=$(curl -fsS -X POST "$PB_URL/api/language-school/admin/accounts/invite/status" \
  -H "Authorization: $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"userId\":\"$EXPIRED_USER_ID\"}")
[ "$(printf '%s' "$EXPIRED_STATE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["invitationStatus"])')" = "EXPIRED" ] || { echo "FAIL: expired invitation should be reported EXPIRED" >&2; exit 1; }
echo "OK: expiration is enforced and visible"

echo "12/12 Invitation records are not readable with normal ADMIN API token"
LOCKED_STATUS=$(curl -sS -o /tmp/locked-invitations.json -w '%{http_code}' \
  "$PB_URL/api/collections/account_invitations/records" -H "Authorization: $ADMIN_TOKEN")
if [ "$LOCKED_STATUS" != "403" ] && [ "$LOCKED_STATUS" != "404" ]; then
  echo "FAIL: invitation collection should be API-locked, got HTTP $LOCKED_STATUS" >&2
  cat /tmp/locked-invitations.json >&2 || true
  exit 1
fi
echo "OK: raw token hashes stay server-only"
echo "ACCOUNT INVITATION SMOKE TEST: SUCCESS"
