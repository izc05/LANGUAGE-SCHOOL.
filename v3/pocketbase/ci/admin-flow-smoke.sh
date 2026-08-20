#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
SUPERUSER_EMAIL="${PB_SUPERUSER_EMAIL:-ci-superuser@example.com}"
SUPERUSER_PASSWORD="${PB_SUPERUSER_PASSWORD:-CiSuperuserPass123!}"
ADMIN_EMAIL="ci-admin@example.com"
ADMIN_PASSWORD="CiAdminPass123!"
TEACHER_EMAIL="ci-teacher@example.com"
TEACHER_PASSWORD="CiTeacherPass123!"
STUDENT_EMAIL="ci-student@example.com"
STUDENT_PASSWORD="CiStudentPass123!"

json_request() {
  local method="$1"
  local url="$2"
  local token="$3"
  local body="$4"
  local response_file status
  response_file="$(mktemp)"

  if [[ -n "$token" ]]; then
    status="$(curl -sS -o "$response_file" -w '%{http_code}' -X "$method" "$url" \
      -H 'Content-Type: application/json' \
      -H "Authorization: $token" \
      --data "$body")"
  else
    status="$(curl -sS -o "$response_file" -w '%{http_code}' -X "$method" "$url" \
      -H 'Content-Type: application/json' \
      --data "$body")"
  fi

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
  local method="$1"
  local url="$2"
  local token="$3"
  local body="$4"
  curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$url" \
    -H 'Content-Type: application/json' \
    -H "Authorization: $token" \
    --data "$body"
}

json_post() {
  json_request 'POST' "$1" "$2" "$3"
}

json_patch() {
  json_request 'PATCH' "$1" "$2" "$3"
}

authenticate() {
  local collection="$1"
  local email="$2"
  local password="$3"
  json_post "$PB_URL/api/collections/$collection/auth-with-password" '' \
    "$(jq -nc --arg identity "$email" --arg password "$password" '{identity:$identity,password:$password}')"
}

create_record() {
  local collection="$1"
  local token="$2"
  local body="$3"
  json_post "$PB_URL/api/collections/$collection/records" "$token" "$body"
}

update_record() {
  local collection="$1"
  local id="$2"
  local token="$3"
  local body="$4"
  json_patch "$PB_URL/api/collections/$collection/records/$id" "$token" "$body"
}

assert_equal() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "ASSERTION FAILED: $label (expected '$expected', got '$actual')" >&2
    exit 1
  fi
  echo "OK: $label"
}

echo '1/21 Authenticate CI superuser'
SUPER_AUTH="$(authenticate '_superusers' "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD")"
SUPER_TOKEN="$(jq -r '.token' <<<"$SUPER_AUTH")"
test -n "$SUPER_TOKEN" && test "$SUPER_TOKEN" != 'null'

echo '2/21 Create application ADMIN with superuser bootstrap'
ADMIN_RECORD="$(create_record 'users' "$SUPER_TOKEN" "$(jq -nc \
  --arg email "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" \
  '{email:$email,password:$password,passwordConfirm:$password,name:"CI",surname:"Admin",role:"ADMIN",status:"ACTIVE",phone:""}')")"
ADMIN_ID="$(jq -r '.id' <<<"$ADMIN_RECORD")"
assert_equal "$(jq -r '.role' <<<"$ADMIN_RECORD")" 'ADMIN' 'bootstrap user has ADMIN role'

echo '3/21 Authenticate as application ADMIN (all following writes use ADMIN rules)'
ADMIN_AUTH="$(authenticate 'users' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
ADMIN_TOKEN="$(jq -r '.token' <<<"$ADMIN_AUTH")"
assert_equal "$(jq -r '.record.id' <<<"$ADMIN_AUTH")" "$ADMIN_ID" 'ADMIN login resolves bootstrap record'

echo '4/21 Create teacher + teacher profile through ADMIN rules'
TEACHER_RECORD="$(create_record 'users' "$ADMIN_TOKEN" "$(jq -nc \
  --arg email "$TEACHER_EMAIL" --arg password "$TEACHER_PASSWORD" \
  '{email:$email,password:$password,passwordConfirm:$password,name:"CI",surname:"Teacher",role:"TEACHER",status:"ACTIVE",phone:""}')")"
TEACHER_ID="$(jq -r '.id' <<<"$TEACHER_RECORD")"
create_record 'teacher_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$TEACHER_ID" '{user:$user,bio:"CI teacher",specialties:["B1"],public_profile:false,active:true}')" >/dev/null

echo '5/21 Create student + student profile through ADMIN rules'
STUDENT_RECORD="$(create_record 'users' "$ADMIN_TOKEN" "$(jq -nc \
  --arg email "$STUDENT_EMAIL" --arg password "$STUDENT_PASSWORD" \
  '{email:$email,password:$password,passwordConfirm:$password,name:"CI",surname:"Student",role:"STUDENT",status:"ACTIVE",phone:""}')")"
STUDENT_ID="$(jq -r '.id' <<<"$STUDENT_RECORD")"
create_record 'student_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$STUDENT_ID" '{user:$user,guardian_name:"",guardian_phone:"",notes_private:"",active:true}')" >/dev/null

echo '6/21 Create course + group with assigned teacher'
COURSE="$(create_record 'courses' "$ADMIN_TOKEN" '{"title":"CI English B1","slug":"ci-english-b1","level":"B1","description":"CI smoke course","status":"ACTIVE","public_visible":false}')"
COURSE_ID="$(jq -r '.id' <<<"$COURSE")"
GROUP="$(create_record 'groups' "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_ID" '{name:"CI B1 Group",course:$course,teacher:$teacher,academic_year:"2026/27",schedule_text:"Thursday 18:00",capacity:8,target_level:"B1",default_delivery_mode:"IN_PERSON",status:"ACTIVE"}')")"
GROUP_ID="$(jq -r '.id' <<<"$GROUP")"
assert_equal "$(jq -r '.teacher' <<<"$GROUP")" "$TEACHER_ID" 'group is assigned to created teacher'
assert_equal "$(jq -r '.target_level' <<<"$GROUP")" 'B1' 'group persists target level'
assert_equal "$(jq -r '.default_delivery_mode' <<<"$GROUP")" 'IN_PERSON' 'group persists default delivery mode'

echo '7/21 Enroll student in group'
ENROLLMENT="$(create_record 'enrollments' "$ADMIN_TOKEN" "$(jq -nc --arg student "$STUDENT_ID" --arg group "$GROUP_ID" '{student:$student,group:$group,status:"ACTIVE",joined_at:"2026-08-12 10:00:00.000Z"}')")"
ENROLLMENT_ID="$(jq -r '.id' <<<"$ENROLLMENT")"
assert_equal "$(jq -r '.student' <<<"$ENROLLMENT")" "$STUDENT_ID" 'enrollment points to created student'
assert_equal "$(jq -r '.group' <<<"$ENROLLMENT")" "$GROUP_ID" 'enrollment points to created group'

echo '8/21 Create scheduled class'
CLASS="$(create_record 'classes' "$ADMIN_TOKEN" "$(jq -nc --arg group "$GROUP_ID" --arg teacher "$TEACHER_ID" '{group:$group,teacher:$teacher,starts_at:"2026-08-13 18:00:00.000Z",ends_at:"2026-08-13 19:00:00.000Z",topic:"CI lesson",description:"Smoke test",status:"SCHEDULED"}')")"
CLASS_ID="$(jq -r '.id' <<<"$CLASS")"
assert_equal "$(jq -r '.status' <<<"$CLASS")" 'SCHEDULED' 'class is scheduled'

echo '9/21 PATCH student account through user update hooks'
STUDENT_PATCH="$(update_record 'users' "$STUDENT_ID" "$ADMIN_TOKEN" '{"phone":"611111111"}')"
assert_equal "$(jq -r '.phone' <<<"$STUDENT_PATCH")" '611111111' 'student PATCH survives account/profile synchronization hooks'

echo '10/21 PATCH group through teacher assignment hooks'
GROUP_PATCH="$(update_record 'groups' "$GROUP_ID" "$ADMIN_TOKEN" "$(jq -nc --arg teacher "$TEACHER_ID" '{teacher:$teacher,target_level:"B1",default_delivery_mode:"HYBRID"}')")"
assert_equal "$(jq -r '.teacher' <<<"$GROUP_PATCH")" "$TEACHER_ID" 'group PATCH validates active teacher without JSVM scope errors'
assert_equal "$(jq -r '.default_delivery_mode' <<<"$GROUP_PATCH")" 'HYBRID' 'group PATCH updates default delivery mode'

echo '11/21 PATCH class through class update hooks'
CLASS_PATCH="$(update_record 'classes' "$CLASS_ID" "$ADMIN_TOKEN" '{"description":"Smoke test updated"}')"
assert_equal "$(jq -r '.description' <<<"$CLASS_PATCH")" 'Smoke test updated' 'class PATCH survives scoped validation hook'

echo '12/21 Create second active enrollment for group capacity checks'
SECOND_STUDENT_RECORD="$(create_record 'users' "$ADMIN_TOKEN" '{"email":"ci-student-two@example.com","password":"CiStudentTwoPass123!","passwordConfirm":"CiStudentTwoPass123!","name":"CI","surname":"Student Two","role":"STUDENT","status":"ACTIVE","phone":""}')"
SECOND_STUDENT_ID="$(jq -r '.id' <<<"$SECOND_STUDENT_RECORD")"
SECOND_ENROLLMENT="$(create_record 'enrollments' "$ADMIN_TOKEN" "$(jq -nc --arg student "$SECOND_STUDENT_ID" --arg group "$GROUP_ID" '{student:$student,group:$group,status:"ACTIVE",joined_at:"2026-08-12 10:05:00.000Z"}')")"
assert_equal "$(jq -r '.status' <<<"$SECOND_ENROLLMENT")" 'ACTIVE' 'second enrollment is active'

echo '13/21 Group capacity cannot drop below active occupancy'
CAPACITY_STATUS="$(request_status 'PATCH' "$PB_URL/api/collections/groups/records/$GROUP_ID" "$ADMIN_TOKEN" '{"capacity":1}')"
assert_equal "$CAPACITY_STATUS" '400' 'group rejects capacity below two active enrollments'

echo '14/21 Active course cannot be archived while it has active groups'
COURSE_ARCHIVE_STATUS="$(request_status 'PATCH' "$PB_URL/api/collections/courses/records/$COURSE_ID" "$ADMIN_TOKEN" '{"status":"ARCHIVED"}')"
assert_equal "$COURSE_ARCHIVE_STATUS" '400' 'course archive is blocked while group stays ACTIVE'

echo '15/21 Active group cannot reactivate against archived course'
PAUSED_GROUP="$(update_record 'groups' "$GROUP_ID" "$ADMIN_TOKEN" '{"status":"PAUSED"}')"
assert_equal "$(jq -r '.status' <<<"$PAUSED_GROUP")" 'PAUSED' 'group can be paused'
ARCHIVED_COURSE="$(update_record 'courses' "$COURSE_ID" "$ADMIN_TOKEN" '{"status":"ARCHIVED"}')"
assert_equal "$(jq -r '.status' <<<"$ARCHIVED_COURSE")" 'ARCHIVED' 'course can archive after active groups are paused'
GROUP_WITH_ARCHIVED_COURSE_STATUS="$(request_status 'PATCH' "$PB_URL/api/collections/groups/records/$GROUP_ID" "$ADMIN_TOKEN" '{"status":"ACTIVE"}')"
assert_equal "$GROUP_WITH_ARCHIVED_COURSE_STATUS" '400' 'group cannot reactivate with archived course'
update_record 'courses' "$COURSE_ID" "$ADMIN_TOKEN" '{"status":"ACTIVE"}' >/dev/null

echo '16/21 Active group cannot reactivate against inactive teacher'
INACTIVE_TEACHER="$(update_record 'users' "$TEACHER_ID" "$ADMIN_TOKEN" '{"status":"INACTIVE"}')"
assert_equal "$(jq -r '.status' <<<"$INACTIVE_TEACHER")" 'INACTIVE' 'teacher can deactivate after active groups are paused'
GROUP_WITH_INACTIVE_TEACHER_STATUS="$(request_status 'PATCH' "$PB_URL/api/collections/groups/records/$GROUP_ID" "$ADMIN_TOKEN" '{"status":"ACTIVE"}')"
assert_equal "$GROUP_WITH_INACTIVE_TEACHER_STATUS" '400' 'group cannot reactivate with inactive teacher'
update_record 'users' "$TEACHER_ID" "$ADMIN_TOKEN" '{"status":"ACTIVE"}' >/dev/null
RESTORED_GROUP="$(update_record 'groups' "$GROUP_ID" "$ADMIN_TOKEN" '{"status":"ACTIVE"}')"
assert_equal "$(jq -r '.status' <<<"$RESTORED_GROUP")" 'ACTIVE' 'group reactivates after course and teacher are valid again'

echo '17/21 Register attendance and verify persisted relation chain'
ATTENDANCE="$(create_record 'attendance' "$ADMIN_TOKEN" "$(jq -nc --arg class "$CLASS_ID" --arg student "$STUDENT_ID" '{class:$class,student:$student,status:"PRESENT",notes:"CI smoke"}')")"
assert_equal "$(jq -r '.status' <<<"$ATTENDANCE")" 'PRESENT' 'attendance is PRESENT'
assert_equal "$(jq -r '.class' <<<"$ATTENDANCE")" "$CLASS_ID" 'attendance points to created class'
assert_equal "$(jq -r '.student' <<<"$ATTENDANCE")" "$STUDENT_ID" 'attendance points to created student'

echo '18/21 Close enrollment as FINISHED'
CLOSED_ENROLLMENT="$(update_record 'enrollments' "$ENROLLMENT_ID" "$ADMIN_TOKEN" '{"status":"FINISHED","ended_at":"2026-08-20 12:00:00.000Z"}')"
assert_equal "$(jq -r '.status' <<<"$CLOSED_ENROLLMENT")" 'FINISHED' 'enrollment closes as FINISHED'

echo '19/21 Closed enrollment cannot transition back to PAUSED'
CLOSED_PATCH_STATUS="$(request_status 'PATCH' "$PB_URL/api/collections/enrollments/records/$ENROLLMENT_ID" "$ADMIN_TOKEN" '{"status":"PAUSED","ended_at":""}')"
assert_equal "$CLOSED_PATCH_STATUS" '400' 'FINISHED enrollment is terminal'

echo '20/21 Capacity can equal remaining active occupancy after one enrollment closes'
CAPACITY_EQUAL="$(update_record 'groups' "$GROUP_ID" "$ADMIN_TOKEN" '{"capacity":1}')"
assert_equal "$(jq -r '.capacity' <<<"$CAPACITY_EQUAL")" '1' 'group accepts capacity equal to one remaining active enrollment'

echo '21/21 Group invariant smoke completed'
assert_equal "$(jq -r '.status' <<<"$RESTORED_GROUP")" 'ACTIVE' 'group ends smoke in a valid ACTIVE state'

echo 'ADMIN FLOW SMOKE TEST: SUCCESS'
