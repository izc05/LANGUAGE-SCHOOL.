#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="ci-admin@example.com"
ADMIN_PASSWORD="CiAdminPass123!"

json_request() {
  local method="$1" url="$2" token="$3" body="$4"
  local response_file status
  response_file="$(mktemp)"
  status="$(curl -sS -o "$response_file" -w '%{http_code}' -X "$method" "$url" \
    -H 'Content-Type: application/json' \
    -H "Authorization: $token" \
    --data "$body")"
  if [[ ! "$status" =~ ^2 ]]; then
    echo "HTTP $status · $method $url" >&2
    cat "$response_file" >&2
    echo >&2
    rm -f "$response_file"
    return 22
  fi
  cat "$response_file"
  rm -f "$response_file"
}

request_status() {
  local method="$1" url="$2" token="$3" body="$4"
  curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$url" \
    -H 'Content-Type: application/json' \
    -H "Authorization: $token" \
    --data "$body"
}

assert_equal() {
  local actual="$1" expected="$2" label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "ASSERTION FAILED: $label (expected '$expected', got '$actual')" >&2
    exit 1
  fi
  echo "OK: $label"
}

authenticate() {
  json_request 'POST' "$PB_URL/api/collections/users/auth-with-password" '' \
    "$(jq -nc --arg identity "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" '{identity:$identity,password:$password}')"
}

create_record() {
  json_request 'POST' "$PB_URL/api/collections/$1/records" "$2" "$3"
}

move_student() {
  local token="$1" student="$2" group="$3"
  json_request 'POST' "$PB_URL/api/language-school/admin/academic/enrollments/move" "$token" \
    "$(jq -nc --arg studentId "$student" --arg targetGroupId "$group" '{studentId:$studentId,targetGroupId:$targetGroupId}')"
}

echo '1/10 Authenticate ADMIN created by admin-flow smoke'
ADMIN_AUTH="$(authenticate)"
ADMIN_TOKEN="$(jq -r '.token' <<<"$ADMIN_AUTH")"
test -n "$ADMIN_TOKEN" && test "$ADMIN_TOKEN" != 'null'

echo '2/10 Resolve an ACTIVE course and TEACHER'
COURSE_LIST="$(json_request 'GET' "$PB_URL/api/collections/courses/records?perPage=1&filter=$(printf '%s' 'status = "ACTIVE"' | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
COURSE_ID="$(jq -r '.items[0].id' <<<"$COURSE_LIST")"
TEACHER_LIST="$(json_request 'GET' "$PB_URL/api/collections/users/records?perPage=1&filter=$(printf '%s' 'role = "TEACHER" && status = "ACTIVE"' | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
TEACHER_ID="$(jq -r '.items[0].id' <<<"$TEACHER_LIST")"
test -n "$COURSE_ID" && test "$COURSE_ID" != 'null'
test -n "$TEACHER_ID" && test "$TEACHER_ID" != 'null'

echo '3/10 Create source and one-seat destination groups'
SOURCE_GROUP="$(create_record 'groups' "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_ID" '{name:"CI 15B3B Source",course:$course,teacher:$teacher,academic_year:"2099/00",schedule_text:"Source",capacity:2,target_level:"B1",default_delivery_mode:"IN_PERSON",status:"ACTIVE"}')")"
SOURCE_GROUP_ID="$(jq -r '.id' <<<"$SOURCE_GROUP")"
TARGET_GROUP="$(create_record 'groups' "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_ID" '{name:"CI 15B3B Target",course:$course,teacher:$teacher,academic_year:"2099/00",schedule_text:"Target",capacity:1,target_level:"B1",default_delivery_mode:"HYBRID",status:"ACTIVE"}')")"
TARGET_GROUP_ID="$(jq -r '.id' <<<"$TARGET_GROUP")"

echo '4/10 Create two ACTIVE students and enroll both in source through the canonical route'
STUDENT_A="$(create_record 'users' "$ADMIN_TOKEN" '{"email":"ci-15b3b-a@example.com","password":"Ci15B3bStudentAPass!","passwordConfirm":"Ci15B3bStudentAPass!","name":"Race","surname":"Student A","role":"STUDENT","status":"ACTIVE","phone":""}')"
STUDENT_B="$(create_record 'users' "$ADMIN_TOKEN" '{"email":"ci-15b3b-b@example.com","password":"Ci15B3bStudentBPass!","passwordConfirm":"Ci15B3bStudentBPass!","name":"Race","surname":"Student B","role":"STUDENT","status":"ACTIVE","phone":""}')"
STUDENT_A_ID="$(jq -r '.id' <<<"$STUDENT_A")"
STUDENT_B_ID="$(jq -r '.id' <<<"$STUDENT_B")"
SOURCE_A="$(move_student "$ADMIN_TOKEN" "$STUDENT_A_ID" "$SOURCE_GROUP_ID")"
SOURCE_B="$(move_student "$ADMIN_TOKEN" "$STUDENT_B_ID" "$SOURCE_GROUP_ID")"
assert_equal "$(jq -r '.unchanged' <<<"$SOURCE_A")" 'false' 'student A created through canonical enrollment route'
assert_equal "$(jq -r '.unchanged' <<<"$SOURCE_B")" 'false' 'student B created through canonical enrollment route'

echo '5/10 Race both students for the single destination seat'
STATUS_A_FILE="$(mktemp)"
STATUS_B_FILE="$(mktemp)"
BODY_A="$(jq -nc --arg studentId "$STUDENT_A_ID" --arg targetGroupId "$TARGET_GROUP_ID" '{studentId:$studentId,targetGroupId:$targetGroupId}')"
BODY_B="$(jq -nc --arg studentId "$STUDENT_B_ID" --arg targetGroupId "$TARGET_GROUP_ID" '{studentId:$studentId,targetGroupId:$targetGroupId}')"
(
  request_status 'POST' "$PB_URL/api/language-school/admin/academic/enrollments/move" "$ADMIN_TOKEN" "$BODY_A" >"$STATUS_A_FILE"
) &
PID_A=$!
(
  request_status 'POST' "$PB_URL/api/language-school/admin/academic/enrollments/move" "$ADMIN_TOKEN" "$BODY_B" >"$STATUS_B_FILE"
) &
PID_B=$!
wait "$PID_A"
wait "$PID_B"
STATUS_A="$(cat "$STATUS_A_FILE")"
STATUS_B="$(cat "$STATUS_B_FILE")"
rm -f "$STATUS_A_FILE" "$STATUS_B_FILE"
SORTED_STATUSES="$(printf '%s\n%s\n' "$STATUS_A" "$STATUS_B" | sort | paste -sd, -)"
assert_equal "$SORTED_STATUSES" '200,400' 'exactly one concurrent move wins the last seat'

if [[ "$STATUS_A" == '200' ]]; then
  WINNER_ID="$STUDENT_A_ID"
  LOSER_ID="$STUDENT_B_ID"
else
  WINNER_ID="$STUDENT_B_ID"
  LOSER_ID="$STUDENT_A_ID"
fi

echo '6/10 Verify winner, loser rollback and destination occupancy'
TARGET_ACTIVE="$(json_request 'GET' "$PB_URL/api/collections/enrollments/records?perPage=10&filter=$(printf '%s' "group = \"$TARGET_GROUP_ID\" && status = \"ACTIVE\"" | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
assert_equal "$(jq -r '.totalItems' <<<"$TARGET_ACTIVE")" '1' 'destination has exactly one ACTIVE enrollment'
WINNER_ACTIVE="$(json_request 'GET' "$PB_URL/api/collections/enrollments/records?perPage=10&filter=$(printf '%s' "student = \"$WINNER_ID\" && status = \"ACTIVE\"" | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
LOSER_ACTIVE="$(json_request 'GET' "$PB_URL/api/collections/enrollments/records?perPage=10&filter=$(printf '%s' "student = \"$LOSER_ID\" && status = \"ACTIVE\"" | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
assert_equal "$(jq -r '.items[0].group' <<<"$WINNER_ACTIVE")" "$TARGET_GROUP_ID" 'winner is active in destination'
assert_equal "$(jq -r '.items[0].group' <<<"$LOSER_ACTIVE")" "$SOURCE_GROUP_ID" 'loser keeps source enrollment after rejected transaction'

echo '7/10 Same destination is idempotent'
IDEMPOTENT="$(move_student "$ADMIN_TOKEN" "$WINNER_ID" "$TARGET_GROUP_ID")"
assert_equal "$(jq -r '.unchanged' <<<"$IDEMPOTENT")" 'true' 'same target returns unchanged'
TARGET_ACTIVE_AFTER="$(json_request 'GET' "$PB_URL/api/collections/enrollments/records?perPage=10&filter=$(printf '%s' "group = \"$TARGET_GROUP_ID\" && status = \"ACTIVE\"" | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
assert_equal "$(jq -r '.totalItems' <<<"$TARGET_ACTIVE_AFTER")" '1' 'idempotent retry creates no duplicate'

echo '8/10 Class creation derives teacher from group server-side'
CLASS="$(create_record 'classes' "$ADMIN_TOKEN" "$(jq -nc --arg group "$TARGET_GROUP_ID" '{group:$group,starts_at:"2099-02-10 18:00:00.000Z",ends_at:"2099-02-10 19:00:00.000Z",topic:"Derived teacher",description:"",status:"SCHEDULED",delivery_mode:"HYBRID"}')")"
CLASS_ID="$(jq -r '.id' <<<"$CLASS")"
assert_equal "$(jq -r '.teacher' <<<"$CLASS")" "$TEACHER_ID" 'class teacher is inherited from group'

echo '9/10 Class teacher cannot diverge from group on PATCH'
CLASS_PATCH="$(json_request 'PATCH' "$PB_URL/api/collections/classes/records/$CLASS_ID" "$ADMIN_TOKEN" "$(jq -nc --arg teacher "$LOSER_ID" '{teacher:$teacher,description:"canonicalized"}')")"
assert_equal "$(jq -r '.teacher' <<<"$CLASS_PATCH")" "$TEACHER_ID" 'class PATCH canonicalizes teacher back to group teacher'

echo '10/10 Non-active destination is rejected without damaging source'
json_request 'PATCH' "$PB_URL/api/collections/groups/records/$TARGET_GROUP_ID" "$ADMIN_TOKEN" '{"status":"PAUSED"}' >/dev/null
PAUSED_MOVE_STATUS="$(request_status 'POST' "$PB_URL/api/language-school/admin/academic/enrollments/move" "$ADMIN_TOKEN" "$(jq -nc --arg studentId "$LOSER_ID" --arg targetGroupId "$TARGET_GROUP_ID" '{studentId:$studentId,targetGroupId:$targetGroupId}')")"
assert_equal "$PAUSED_MOVE_STATUS" '400' 'paused destination rejects enrollment move'
LOSER_ACTIVE_AFTER="$(json_request 'GET' "$PB_URL/api/collections/enrollments/records?perPage=10&filter=$(printf '%s' "student = \"$LOSER_ID\" && status = \"ACTIVE\"" | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
assert_equal "$(jq -r '.items[0].group' <<<"$LOSER_ACTIVE_AFTER")" "$SOURCE_GROUP_ID" 'rejected paused move preserves source enrollment'

echo 'ACADEMIC OPERATIONS 15B.3B SMOKE TEST: SUCCESS'
