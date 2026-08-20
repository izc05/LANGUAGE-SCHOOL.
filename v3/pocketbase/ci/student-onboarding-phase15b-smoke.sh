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

invite_student() {
  local token="$1" email="$2" name="$3"
  json_request 'POST' "$PB_URL/api/language-school/admin/accounts/invite" "$token" \
    "$(jq -nc --arg email "$email" --arg name "$name" '{role:"STUDENT",email:$email,name:$name,surname:"Onboarding",phone:"",birthDate:"",guardianName:"",guardianPhone:"",notesPrivate:"",activationBaseUrl:""}')"
}

onboard_status() {
  local token="$1" student="$2" group="$3" course="$4" acknowledge="$5"
  request_status 'POST' "$PB_URL/api/language-school/admin/academic/enrollments/onboard" "$token" \
    "$(jq -nc --arg studentId "$student" --arg targetGroupId "$group" --arg expectedCourseId "$course" --argjson acknowledgeLevelMismatch "$acknowledge" '{studentId:$studentId,targetGroupId:$targetGroupId,expectedCourseId:$expectedCourseId,acknowledgeLevelMismatch:$acknowledgeLevelMismatch}')"
}

onboard() {
  local token="$1" student="$2" group="$3" course="$4" acknowledge="$5"
  json_request 'POST' "$PB_URL/api/language-school/admin/academic/enrollments/onboard" "$token" \
    "$(jq -nc --arg studentId "$student" --arg targetGroupId "$group" --arg expectedCourseId "$course" --argjson acknowledgeLevelMismatch "$acknowledge" '{studentId:$studentId,targetGroupId:$targetGroupId,expectedCourseId:$expectedCourseId,acknowledgeLevelMismatch:$acknowledgeLevelMismatch}')"
}

echo '1/9 Authenticate ADMIN and resolve academic dependencies'
ADMIN_AUTH="$(json_request 'POST' "$PB_URL/api/collections/users/auth-with-password" '' "$(jq -nc --arg identity "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" '{identity:$identity,password:$password}')")"
ADMIN_TOKEN="$(jq -r '.token' <<<"$ADMIN_AUTH")"
ADMIN_ID="$(jq -r '.record.id' <<<"$ADMIN_AUTH")"
COURSE_LIST="$(json_request 'GET' "$PB_URL/api/collections/courses/records?perPage=1&filter=$(printf '%s' 'status = "ACTIVE"' | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
COURSE_ID="$(jq -r '.items[0].id' <<<"$COURSE_LIST")"
TEACHER_LIST="$(json_request 'GET' "$PB_URL/api/collections/users/records?perPage=1&filter=$(printf '%s' 'role = "TEACHER" && status = "ACTIVE"' | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
TEACHER_ID="$(jq -r '.items[0].id' <<<"$TEACHER_LIST")"
test -n "$ADMIN_TOKEN" && test "$COURSE_ID" != 'null' && test "$TEACHER_ID" != 'null'

echo '2/9 Create B1 onboarding group with two seats'
GROUP="$(json_request 'POST' "$PB_URL/api/collections/groups/records" "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_ID" '{name:"CI 15B3C Onboarding",course:$course,teacher:$teacher,academic_year:"2099/00",schedule_text:"Tue 18:00",capacity:2,target_level:"B1",default_delivery_mode:"HYBRID",status:"ACTIVE"}')")"
GROUP_ID="$(jq -r '.id' <<<"$GROUP")"

echo '3/9 Create genuine INVITED student and B2 INITIAL assessment'
INVITE_A="$(invite_student "$ADMIN_TOKEN" 'ci-15b3c-a@example.com' 'Mismatch')"
STUDENT_A_ID="$(jq -r '.userId' <<<"$INVITE_A")"
assert_equal "$(jq -r '.emailSent' <<<"$INVITE_A")" 'false' 'draft invitation is not sent before academic setup'
ASSESSMENT_A="$(json_request 'POST' "$PB_URL/api/collections/student_level_assessments/records" "$ADMIN_TOKEN" "$(jq -nc --arg student "$STUDENT_A_ID" --arg admin "$ADMIN_ID" '{student:$student,validated_level:"B2",notes:"CI initial level",assessed_by:$admin,assessed_at:"2099-01-01 10:00:00.000Z",reason:"INITIAL"}')")"
assert_equal "$(jq -r '.validated_level' <<<"$ASSESSMENT_A")" 'B2' 'INITIAL assessment uses existing level history'

echo '4/9 Mismatch is rejected until ADMIN acknowledges it'
STATUS_MISMATCH="$(onboard_status "$ADMIN_TOKEN" "$STUDENT_A_ID" "$GROUP_ID" "$COURSE_ID" false)"
assert_equal "$STATUS_MISMATCH" '400' 'B2 student cannot enter B1 group without explicit acknowledgement'
NO_ENROLLMENT_A="$(json_request 'GET' "$PB_URL/api/collections/enrollments/records?perPage=10&filter=$(printf '%s' "student = \"$STUDENT_A_ID\" && status = \"ACTIVE\"" | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
assert_equal "$(jq -r '.totalItems' <<<"$NO_ENROLLMENT_A")" '0' 'rejected mismatch creates no enrollment'

echo '5/9 Acknowledged mismatch enrolls INVITED student and derives group truth'
ONBOARD_A="$(onboard "$ADMIN_TOKEN" "$STUDENT_A_ID" "$GROUP_ID" "$COURSE_ID" true)"
assert_equal "$(jq -r '.studentStatus' <<<"$ONBOARD_A")" 'INVITED' 'pending account can be academically enrolled'
assert_equal "$(jq -r '.currentLevel' <<<"$ONBOARD_A")" 'B2' 'server reads current validated level'
assert_equal "$(jq -r '.targetLevel' <<<"$ONBOARD_A")" 'B1' 'server reads target group level'
assert_equal "$(jq -r '.levelMismatch' <<<"$ONBOARD_A")" 'true' 'server reports acknowledged mismatch'
assert_equal "$(jq -r '.teacherId' <<<"$ONBOARD_A")" "$TEACHER_ID" 'professor is derived from group'
assert_equal "$(jq -r '.courseId' <<<"$ONBOARD_A")" "$COURSE_ID" 'course is derived from group'
USER_A="$(json_request 'GET' "$PB_URL/api/collections/users/records/$STUDENT_A_ID" "$ADMIN_TOKEN" '')"
assert_equal "$(jq -r '.status' <<<"$USER_A")" 'INVITED' 'academic setup does not activate login account'

echo '6/9 Same onboarding target is idempotent'
ONBOARD_A_RETRY="$(onboard "$ADMIN_TOKEN" "$STUDENT_A_ID" "$GROUP_ID" "$COURSE_ID" true)"
assert_equal "$(jq -r '.unchanged' <<<"$ONBOARD_A_RETRY")" 'true' 'same initial group creates no duplicate enrollment'

echo '7/9 INVITED student without known level can enroll without mismatch acknowledgement'
INVITE_B="$(invite_student "$ADMIN_TOKEN" 'ci-15b3c-b@example.com' 'Unevaluated')"
STUDENT_B_ID="$(jq -r '.userId' <<<"$INVITE_B")"
ONBOARD_B="$(onboard "$ADMIN_TOKEN" "$STUDENT_B_ID" "$GROUP_ID" "$COURSE_ID" false)"
assert_equal "$(jq -r '.currentLevel' <<<"$ONBOARD_B")" '' 'unevaluated student has no invented level'
assert_equal "$(jq -r '.levelMismatch' <<<"$ONBOARD_B")" 'false' 'unknown level does not create false mismatch'

echo '8/9 Capacity is still enforced inside onboarding transaction'
INVITE_C="$(invite_student "$ADMIN_TOKEN" 'ci-15b3c-c@example.com' 'Full')"
STUDENT_C_ID="$(jq -r '.userId' <<<"$INVITE_C")"
FULL_STATUS="$(onboard_status "$ADMIN_TOKEN" "$STUDENT_C_ID" "$GROUP_ID" "$COURSE_ID" false)"
assert_equal "$FULL_STATUS" '400' 'full onboarding group rejects another student'
C_ENROLLMENT="$(json_request 'GET' "$PB_URL/api/collections/enrollments/records?perPage=10&filter=$(printf '%s' "student = \"$STUDENT_C_ID\" && status = \"ACTIVE\"" | jq -sRr @uri)" "$ADMIN_TOKEN" '')"
assert_equal "$(jq -r '.totalItems' <<<"$C_ENROLLMENT")" '0' 'capacity rejection leaves no enrollment'

echo '9/9 INACTIVE students remain rejected'
INACTIVE="$(json_request 'POST' "$PB_URL/api/collections/users/records" "$ADMIN_TOKEN" '{"email":"ci-15b3c-inactive@example.com","password":"Ci15B3cInactivePass!","passwordConfirm":"Ci15B3cInactivePass!","name":"Inactive","surname":"Onboarding","role":"STUDENT","status":"INACTIVE","phone":""}')"
INACTIVE_ID="$(jq -r '.id' <<<"$INACTIVE")"
INACTIVE_STATUS="$(onboard_status "$ADMIN_TOKEN" "$INACTIVE_ID" "$GROUP_ID" "$COURSE_ID" false)"
assert_equal "$INACTIVE_STATUS" '400' 'inactive student cannot be onboarded'

echo 'STUDENT ONBOARDING 15B.3C.1 SMOKE TEST: SUCCESS'
