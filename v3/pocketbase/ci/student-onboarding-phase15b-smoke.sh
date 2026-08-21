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

assert_nonempty() {
  local actual="$1" label="$2"
  if [[ -z "$actual" || "$actual" == 'null' ]]; then
    echo "ASSERTION FAILED: $label (value is empty)" >&2
    exit 1
  fi
  echo "OK: $label"
}

encoded_filter() {
  printf '%s' "$1" | jq -sRr @uri
}

record_list() {
  local token="$1" collection="$2" filter="$3"
  json_request 'GET' "$PB_URL/api/collections/$collection/records?perPage=50&filter=$(encoded_filter "$filter")" "$token" ''
}

collection_total() {
  local token="$1" collection="$2"
  json_request 'GET' "$PB_URL/api/collections/$collection/records?perPage=1" "$token" '' | jq -r '.totalItems'
}

user_count_by_email() {
  local token="$1" email="$2"
  record_list "$token" 'users' "email = \"$email\"" | jq -r '.totalItems'
}

complete_body() {
  local email="$1" name="$2" group="$3" course="$4" mode="$5" level="$6" acknowledge="$7"
  jq -nc \
    --arg email "$email" --arg name "$name" --arg targetGroupId "$group" --arg expectedCourseId "$course" \
    --arg levelMode "$mode" --arg initialLevel "$level" --argjson acknowledgeLevelMismatch "$acknowledge" \
    '{email:$email,name:$name,surname:"Atomic",phone:"600000000",birthDate:"2001-05-14",guardianName:"",guardianPhone:"",notesPrivate:"CI atomic onboarding",levelMode:$levelMode,initialLevel:$initialLevel,levelNotes:"CI initial assessment",targetGroupId:$targetGroupId,expectedCourseId:$expectedCourseId,acknowledgeLevelMismatch:$acknowledgeLevelMismatch,activationBaseUrl:"http://127.0.0.1:4173"}'
}

complete_status() {
  local token="$1" email="$2" name="$3" group="$4" course="$5" mode="$6" level="$7" acknowledge="$8"
  request_status 'POST' "$PB_URL/api/language-school/admin/student-onboarding/complete" "$token" \
    "$(complete_body "$email" "$name" "$group" "$course" "$mode" "$level" "$acknowledge")"
}

complete_onboarding() {
  local token="$1" email="$2" name="$3" group="$4" course="$5" mode="$6" level="$7" acknowledge="$8"
  json_request 'POST' "$PB_URL/api/language-school/admin/student-onboarding/complete" "$token" \
    "$(complete_body "$email" "$name" "$group" "$course" "$mode" "$level" "$acknowledge")"
}

echo '1/10 Authenticate ADMIN and resolve active course/teacher'
ADMIN_AUTH="$(json_request 'POST' "$PB_URL/api/collections/users/auth-with-password" '' "$(jq -nc --arg identity "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" '{identity:$identity,password:$password}')")"
ADMIN_TOKEN="$(jq -r '.token' <<<"$ADMIN_AUTH")"
COURSE_LIST="$(json_request 'GET' "$PB_URL/api/collections/courses/records?perPage=1&filter=$(encoded_filter 'status = "ACTIVE"')" "$ADMIN_TOKEN" '')"
COURSE_ID="$(jq -r '.items[0].id' <<<"$COURSE_LIST")"
TEACHER_LIST="$(json_request 'GET' "$PB_URL/api/collections/users/records?perPage=1&filter=$(encoded_filter 'role = "TEACHER" && status = "ACTIVE"')" "$ADMIN_TOKEN" '')"
TEACHER_ID="$(jq -r '.items[0].id' <<<"$TEACHER_LIST")"
assert_nonempty "$ADMIN_TOKEN" 'ADMIN authenticated'
assert_nonempty "$COURSE_ID" 'active course resolved'
assert_nonempty "$TEACHER_ID" 'active teacher resolved'

echo '2/10 Create B1 atomic group with exactly one seat'
GROUP_ONE="$(json_request 'POST' "$PB_URL/api/collections/groups/records" "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_ID" '{name:"CI 15B3C Atomic One",course:$course,teacher:$teacher,academic_year:"2099/00",schedule_text:"Tue 18:00",capacity:1,target_level:"B1",default_delivery_mode:"HYBRID",status:"ACTIVE"}')")"
GROUP_ONE_ID="$(jq -r '.id' <<<"$GROUP_ONE")"
assert_nonempty "$GROUP_ONE_ID" 'single-seat onboarding group created'

echo '3/10 Mismatch is rejected before persistence when acknowledgement is missing'
NO_ACK_EMAIL='ci-15b3c-atomic-noack@example.com'
NO_ACK_STATUS="$(complete_status "$ADMIN_TOKEN" "$NO_ACK_EMAIL" 'NoAck' "$GROUP_ONE_ID" "$COURSE_ID" 'INITIAL' 'B2' false)"
assert_equal "$NO_ACK_STATUS" '400' 'B2 -> B1 requires explicit pedagogical acknowledgement'
assert_equal "$(user_count_by_email "$ADMIN_TOKEN" "$NO_ACK_EMAIL")" '0' 'rejected mismatch creates no user'

echo '4/10 Atomic success creates account, profile, INITIAL level, enrollment and invitation contract'
SUCCESS_EMAIL='ci-15b3c-atomic-success@example.com'
SUCCESS="$(complete_onboarding "$ADMIN_TOKEN" "$SUCCESS_EMAIL" 'AtomicSuccess' "$GROUP_ONE_ID" "$COURSE_ID" 'INITIAL' 'B2' true)"
SUCCESS_USER_ID="$(jq -r '.userId' <<<"$SUCCESS")"
SUCCESS_PROFILE_ID="$(jq -r '.profileId' <<<"$SUCCESS")"
SUCCESS_ASSESSMENT_ID="$(jq -r '.assessmentId' <<<"$SUCCESS")"
SUCCESS_ENROLLMENT_ID="$(jq -r '.enrollmentId' <<<"$SUCCESS")"
assert_nonempty "$SUCCESS_USER_ID" 'atomic response contains user'
assert_nonempty "$SUCCESS_PROFILE_ID" 'atomic response contains profile'
assert_nonempty "$SUCCESS_ASSESSMENT_ID" 'atomic response contains INITIAL assessment'
assert_nonempty "$SUCCESS_ENROLLMENT_ID" 'atomic response contains enrollment'
assert_equal "$(jq -r '.studentStatus' <<<"$SUCCESS")" 'INVITED' 'new account remains invited'
assert_equal "$(jq -r '.currentLevel' <<<"$SUCCESS")" 'B2' 'INITIAL level is returned as current level'
assert_equal "$(jq -r '.targetLevel' <<<"$SUCCESS")" 'B1' 'target level is derived from group'
assert_equal "$(jq -r '.levelMismatch' <<<"$SUCCESS")" 'true' 'acknowledged mismatch is preserved'
assert_equal "$(jq -r '.courseId' <<<"$SUCCESS")" "$COURSE_ID" 'course is derived from group'
assert_equal "$(jq -r '.teacherId' <<<"$SUCCESS")" "$TEACHER_ID" 'teacher is derived from group'
assert_equal "$(jq -r '.invitation.status' <<<"$SUCCESS")" 'PENDING' 'invitation is pending after atomic commit'
assert_equal "$(jq -r '.invitation.role' <<<"$SUCCESS")" 'STUDENT' 'invitation belongs to student lifecycle'
assert_nonempty "$(jq -r '.invitation.activationUrl' <<<"$SUCCESS")" 'activation fallback URL is returned'

USER_RECORD="$(json_request 'GET' "$PB_URL/api/collections/users/records/$SUCCESS_USER_ID" "$ADMIN_TOKEN" '')"
assert_equal "$(jq -r '.status' <<<"$USER_RECORD")" 'INVITED' 'persisted user is INVITED'
assert_equal "$(jq -r '.verified' <<<"$USER_RECORD")" 'false' 'invited user is not verified'
PROFILE_LIST="$(record_list "$ADMIN_TOKEN" 'student_profiles' "user = \"$SUCCESS_USER_ID\"")"
assert_equal "$(jq -r '.totalItems' <<<"$PROFILE_LIST")" '1' 'exactly one student profile exists'
assert_equal "$(jq -r '.items[0].active' <<<"$PROFILE_LIST")" 'false' 'profile remains inactive until account activation'
ASSESSMENT_LIST="$(record_list "$ADMIN_TOKEN" 'student_level_assessments' "student = \"$SUCCESS_USER_ID\"")"
assert_equal "$(jq -r '.totalItems' <<<"$ASSESSMENT_LIST")" '1' 'exactly one INITIAL assessment exists'
assert_equal "$(jq -r '.items[0].validated_level' <<<"$ASSESSMENT_LIST")" 'B2' 'persisted INITIAL level is B2'
assert_equal "$(jq -r '.items[0].reason' <<<"$ASSESSMENT_LIST")" 'INITIAL' 'assessment reason is INITIAL'
ENROLLMENT_LIST="$(record_list "$ADMIN_TOKEN" 'enrollments' "student = \"$SUCCESS_USER_ID\" && status = \"ACTIVE\"")"
assert_equal "$(jq -r '.totalItems' <<<"$ENROLLMENT_LIST")" '1' 'exactly one active enrollment exists'
assert_equal "$(jq -r '.items[0].group' <<<"$ENROLLMENT_LIST")" "$GROUP_ONE_ID" 'enrollment targets confirmed group'
INVITE_STATUS="$(json_request 'POST' "$PB_URL/api/language-school/admin/accounts/invite/status" "$ADMIN_TOKEN" "$(jq -nc --arg userId "$SUCCESS_USER_ID" '{userId:$userId}')")"
assert_equal "$(jq -r '.invitationStatus' <<<"$INVITE_STATUS")" 'PENDING' 'secure status endpoint sees pending invitation'

echo '5/10 Capture collection totals before deliberate post-write capacity failure'
USERS_BEFORE="$(collection_total "$ADMIN_TOKEN" 'users')"
PROFILES_BEFORE="$(collection_total "$ADMIN_TOKEN" 'student_profiles')"
ASSESSMENTS_BEFORE="$(collection_total "$ADMIN_TOKEN" 'student_level_assessments')"
ENROLLMENTS_BEFORE="$(collection_total "$ADMIN_TOKEN" 'enrollments')"

echo '6/10 Full group aborts after transaction writes and rolls everything back'
FULL_EMAIL='ci-15b3c-atomic-full@example.com'
FULL_STATUS="$(complete_status "$ADMIN_TOKEN" "$FULL_EMAIL" 'Rollback' "$GROUP_ONE_ID" "$COURSE_ID" 'INITIAL' 'B1' false)"
assert_equal "$FULL_STATUS" '400' 'full group rejects atomic onboarding'
assert_equal "$(user_count_by_email "$ADMIN_TOKEN" "$FULL_EMAIL")" '0' 'rolled-back account does not exist'
assert_equal "$(collection_total "$ADMIN_TOKEN" 'users')" "$USERS_BEFORE" 'user count unchanged after rollback'
assert_equal "$(collection_total "$ADMIN_TOKEN" 'student_profiles')" "$PROFILES_BEFORE" 'profile count unchanged after rollback'
assert_equal "$(collection_total "$ADMIN_TOKEN" 'student_level_assessments')" "$ASSESSMENTS_BEFORE" 'assessment count unchanged after rollback'
assert_equal "$(collection_total "$ADMIN_TOKEN" 'enrollments')" "$ENROLLMENTS_BEFORE" 'enrollment count unchanged after rollback'

echo '7/10 Create open B1 group for UNEVALUATED and TEST modes'
GROUP_OPEN="$(json_request 'POST' "$PB_URL/api/collections/groups/records" "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_ID" '{name:"CI 15B3C Atomic Open",course:$course,teacher:$teacher,academic_year:"2099/00",schedule_text:"Thu 10:00",capacity:2,target_level:"B1",default_delivery_mode:"IN_PERSON",status:"ACTIVE"}')")"
GROUP_OPEN_ID="$(jq -r '.id' <<<"$GROUP_OPEN")"
assert_nonempty "$GROUP_OPEN_ID" 'open onboarding group created'

echo '8/10 UNEVALUATED creates no invented level and still enrolls securely'
UNEVALUATED_EMAIL='ci-15b3c-atomic-unevaluated@example.com'
UNEVALUATED="$(complete_onboarding "$ADMIN_TOKEN" "$UNEVALUATED_EMAIL" 'Unevaluated' "$GROUP_OPEN_ID" "$COURSE_ID" 'UNEVALUATED' '' false)"
UNEVALUATED_ID="$(jq -r '.userId' <<<"$UNEVALUATED")"
assert_equal "$(jq -r '.assessmentId' <<<"$UNEVALUATED")" 'null' 'UNEVALUATED creates no assessment'
assert_equal "$(jq -r '.currentLevel' <<<"$UNEVALUATED")" '' 'UNEVALUATED invents no current level'
assert_equal "$(jq -r '.levelMismatch' <<<"$UNEVALUATED")" 'false' 'unknown level creates no false mismatch'
assert_equal "$(record_list "$ADMIN_TOKEN" 'student_level_assessments' "student = \"$UNEVALUATED_ID\"" | jq -r '.totalItems')" '0' 'UNEVALUATED persists no level assessment'

echo '9/10 TEST mode also keeps level pending without fabricating an assessment'
TEST_EMAIL='ci-15b3c-atomic-test@example.com'
TEST_RESULT="$(complete_onboarding "$ADMIN_TOKEN" "$TEST_EMAIL" 'TestPending' "$GROUP_OPEN_ID" "$COURSE_ID" 'TEST' '' false)"
TEST_ID="$(jq -r '.userId' <<<"$TEST_RESULT")"
assert_equal "$(jq -r '.assessmentId' <<<"$TEST_RESULT")" 'null' 'TEST mode creates no INITIAL assessment'
assert_equal "$(jq -r '.currentLevel' <<<"$TEST_RESULT")" '' 'TEST mode leaves current level pending'
assert_equal "$(record_list "$ADMIN_TOKEN" 'student_level_assessments' "student = \"$TEST_ID\"" | jq -r '.totalItems')" '0' 'TEST mode persists no fake level assessment'

echo '10/10 Final atomic state keeps one active enrollment per created student'
UNEVALUATED_ENROLLMENTS="$(record_list "$ADMIN_TOKEN" 'enrollments' "student = \"$UNEVALUATED_ID\" && status = \"ACTIVE\"")"
TEST_ENROLLMENTS="$(record_list "$ADMIN_TOKEN" 'enrollments' "student = \"$TEST_ID\" && status = \"ACTIVE\"")"
assert_equal "$(jq -r '.totalItems' <<<"$UNEVALUATED_ENROLLMENTS")" '1' 'UNEVALUATED student has one active enrollment'
assert_equal "$(jq -r '.totalItems' <<<"$TEST_ENROLLMENTS")" '1' 'TEST student has one active enrollment'

echo 'STUDENT ONBOARDING 15B.3C.3 ATOMIC SMOKE TEST: SUCCESS'
