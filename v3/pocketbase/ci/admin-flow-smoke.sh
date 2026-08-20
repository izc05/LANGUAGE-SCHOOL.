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

json_post() {
  local url="$1"
  local token="$2"
  local body="$3"
  local response_file status
  response_file="$(mktemp)"

  if [[ -n "$token" ]]; then
    status="$(curl -sS -o "$response_file" -w '%{http_code}' -X POST "$url" \
      -H 'Content-Type: application/json' \
      -H "Authorization: $token" \
      --data "$body")"
  else
    status="$(curl -sS -o "$response_file" -w '%{http_code}' -X POST "$url" \
      -H 'Content-Type: application/json' \
      --data "$body")"
  fi

  if [[ ! "$status" =~ ^2 ]]; then
    echo "HTTP $status · POST $url" >&2
    cat "$response_file" >&2
    echo >&2
    rm -f "$response_file"
    return 22
  fi

  cat "$response_file"
  rm -f "$response_file"
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

echo '1/9 Authenticate CI superuser'
SUPER_AUTH="$(authenticate '_superusers' "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD")"
SUPER_TOKEN="$(jq -r '.token' <<<"$SUPER_AUTH")"
test -n "$SUPER_TOKEN" && test "$SUPER_TOKEN" != 'null'

echo '2/9 Create application ADMIN with superuser bootstrap'
ADMIN_RECORD="$(create_record 'users' "$SUPER_TOKEN" "$(jq -nc \
  --arg email "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" \
  '{email:$email,password:$password,passwordConfirm:$password,name:"CI",surname:"Admin",role:"ADMIN",status:"ACTIVE",phone:""}')")"
ADMIN_ID="$(jq -r '.id' <<<"$ADMIN_RECORD")"
assert_equal "$(jq -r '.role' <<<"$ADMIN_RECORD")" 'ADMIN' 'bootstrap user has ADMIN role'

echo '3/9 Authenticate as application ADMIN (all following writes use ADMIN rules)'
ADMIN_AUTH="$(authenticate 'users' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
ADMIN_TOKEN="$(jq -r '.token' <<<"$ADMIN_AUTH")"
assert_equal "$(jq -r '.record.id' <<<"$ADMIN_AUTH")" "$ADMIN_ID" 'ADMIN login resolves bootstrap record'

echo '4/9 Create teacher + teacher profile through ADMIN rules'
TEACHER_RECORD="$(create_record 'users' "$ADMIN_TOKEN" "$(jq -nc \
  --arg email "$TEACHER_EMAIL" --arg password "$TEACHER_PASSWORD" \
  '{email:$email,password:$password,passwordConfirm:$password,name:"CI",surname:"Teacher",role:"TEACHER",status:"ACTIVE",phone:""}')")"
TEACHER_ID="$(jq -r '.id' <<<"$TEACHER_RECORD")"
create_record 'teacher_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$TEACHER_ID" '{user:$user,bio:"CI teacher",specialties:["B1"],public_profile:false,active:true}')" >/dev/null

echo '5/9 Create student + student profile through ADMIN rules'
STUDENT_RECORD="$(create_record 'users' "$ADMIN_TOKEN" "$(jq -nc \
  --arg email "$STUDENT_EMAIL" --arg password "$STUDENT_PASSWORD" \
  '{email:$email,password:$password,passwordConfirm:$password,name:"CI",surname:"Student",role:"STUDENT",status:"ACTIVE",phone:""}')")"
STUDENT_ID="$(jq -r '.id' <<<"$STUDENT_RECORD")"
create_record 'student_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$STUDENT_ID" '{user:$user,guardian_name:"",guardian_phone:"",notes_private:"",active:true}')" >/dev/null

echo '6/9 Create course + group with assigned teacher'
COURSE="$(create_record 'courses' "$ADMIN_TOKEN" '{"title":"CI English B1","slug":"ci-english-b1","level":"B1","description":"CI smoke course","status":"ACTIVE","public_visible":false}')"
COURSE_ID="$(jq -r '.id' <<<"$COURSE")"
GROUP="$(create_record 'groups' "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_ID" '{name:"CI B1 Group",course:$course,teacher:$teacher,academic_year:"2026/27",schedule_text:"Thursday 18:00",capacity:8,status:"ACTIVE"}')")"
GROUP_ID="$(jq -r '.id' <<<"$GROUP")"
assert_equal "$(jq -r '.teacher' <<<"$GROUP")" "$TEACHER_ID" 'group is assigned to created teacher'

echo '7/9 Enroll student in group'
ENROLLMENT="$(create_record 'enrollments' "$ADMIN_TOKEN" "$(jq -nc --arg student "$STUDENT_ID" --arg group "$GROUP_ID" '{student:$student,group:$group,status:"ACTIVE",joined_at:"2026-08-12 10:00:00.000Z"}')")"
assert_equal "$(jq -r '.student' <<<"$ENROLLMENT")" "$STUDENT_ID" 'enrollment points to created student'
assert_equal "$(jq -r '.group' <<<"$ENROLLMENT")" "$GROUP_ID" 'enrollment points to created group'

echo '8/9 Create scheduled class'
CLASS="$(create_record 'classes' "$ADMIN_TOKEN" "$(jq -nc --arg group "$GROUP_ID" --arg teacher "$TEACHER_ID" '{group:$group,teacher:$teacher,starts_at:"2026-08-13 18:00:00.000Z",ends_at:"2026-08-13 19:00:00.000Z",topic:"CI lesson",description:"Smoke test",status:"SCHEDULED"}')")"
CLASS_ID="$(jq -r '.id' <<<"$CLASS")"
assert_equal "$(jq -r '.status' <<<"$CLASS")" 'SCHEDULED' 'class is scheduled'

echo '9/9 Register attendance and verify persisted relation chain'
ATTENDANCE="$(create_record 'attendance' "$ADMIN_TOKEN" "$(jq -nc --arg class "$CLASS_ID" --arg student "$STUDENT_ID" '{class:$class,student:$student,status:"PRESENT",notes:"CI smoke"}')")"
assert_equal "$(jq -r '.status' <<<"$ATTENDANCE")" 'PRESENT' 'attendance is PRESENT'
assert_equal "$(jq -r '.class' <<<"$ATTENDANCE")" "$CLASS_ID" 'attendance points to created class'
assert_equal "$(jq -r '.student' <<<"$ATTENDANCE")" "$STUDENT_ID" 'attendance points to created student'

echo 'ADMIN FLOW SMOKE TEST: SUCCESS'
