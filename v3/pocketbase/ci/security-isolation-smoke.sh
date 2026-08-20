#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="ci-admin@example.com"
ADMIN_PASSWORD="CiAdminPass123!"
PASSWORD="CiIsolationPass123!"
TMP_DIR="${RUNNER_TEMP:-/tmp}/language-school-security-smoke"
mkdir -p "$TMP_DIR"

json_post() {
  local url="$1" token="$2" body="$3"
  curl -fsS -X POST "$url" \
    -H 'Content-Type: application/json' \
    -H "Authorization: $token" \
    --data "$body"
}

authenticate() {
  local email="$1" password="$2"
  curl -fsS -X POST "$PB_URL/api/collections/users/auth-with-password" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg identity "$email" --arg password "$password" '{identity:$identity,password:$password}')"
}

create_record() {
  local collection="$1" token="$2" body="$3"
  json_post "$PB_URL/api/collections/$collection/records" "$token" "$body"
}

http_status() {
  local method="$1" url="$2" token="$3"
  curl -sS -o "$TMP_DIR/response-body" -w '%{http_code}' \
    -X "$method" "$url" \
    -H "Authorization: $token"
}

assert_status() {
  local actual="$1" expected="$2" label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "ASSERTION FAILED: $label (expected HTTP $expected, got $actual)" >&2
    cat "$TMP_DIR/response-body" >&2 || true
    exit 1
  fi
  echo "OK: $label"
}

assert_denied() {
  local actual="$1" label="$2"
  case "$actual" in
    400|401|403|404) echo "OK: $label denied with HTTP $actual" ;;
    *)
      echo "ASSERTION FAILED: $label should be denied, got HTTP $actual" >&2
      cat "$TMP_DIR/response-body" >&2 || true
      exit 1
      ;;
  esac
}

create_user() {
  local token="$1" email="$2" role="$3" surname="$4"
  create_record 'users' "$token" "$(jq -nc \
    --arg email "$email" --arg password "$PASSWORD" --arg role "$role" --arg surname "$surname" \
    '{email:$email,password:$password,passwordConfirm:$password,name:"CI",surname:$surname,role:$role,status:"ACTIVE",phone:""}')"
}

echo '1/12 Authenticate application ADMIN created by the ADMIN flow smoke test'
ADMIN_AUTH="$(authenticate "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
ADMIN_TOKEN="$(jq -r '.token' <<<"$ADMIN_AUTH")"
test -n "$ADMIN_TOKEN" && test "$ADMIN_TOKEN" != 'null'

echo '2/12 Create isolated Teacher A/B and Student A/B'
TEACHER_A_EMAIL='ci-teacher-a@example.com'
TEACHER_B_EMAIL='ci-teacher-b@example.com'
STUDENT_A_EMAIL='ci-student-a@example.com'
STUDENT_B_EMAIL='ci-student-b@example.com'

TEACHER_A="$(create_user "$ADMIN_TOKEN" "$TEACHER_A_EMAIL" 'TEACHER' 'TeacherA')"
TEACHER_B="$(create_user "$ADMIN_TOKEN" "$TEACHER_B_EMAIL" 'TEACHER' 'TeacherB')"
STUDENT_A="$(create_user "$ADMIN_TOKEN" "$STUDENT_A_EMAIL" 'STUDENT' 'StudentA')"
STUDENT_B="$(create_user "$ADMIN_TOKEN" "$STUDENT_B_EMAIL" 'STUDENT' 'StudentB')"

TEACHER_A_ID="$(jq -r '.id' <<<"$TEACHER_A")"
TEACHER_B_ID="$(jq -r '.id' <<<"$TEACHER_B")"
STUDENT_A_ID="$(jq -r '.id' <<<"$STUDENT_A")"
STUDENT_B_ID="$(jq -r '.id' <<<"$STUDENT_B")"

create_record 'teacher_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$TEACHER_A_ID" '{user:$user,bio:"Teacher A",specialties:["B1"],public_profile:false,active:true}')" >/dev/null
create_record 'teacher_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$TEACHER_B_ID" '{user:$user,bio:"Teacher B",specialties:["B1"],public_profile:false,active:true}')" >/dev/null
create_record 'student_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$STUDENT_A_ID" '{user:$user,guardian_name:"",guardian_phone:"",notes_private:"A private",active:true}')" >/dev/null
create_record 'student_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$STUDENT_B_ID" '{user:$user,guardian_name:"",guardian_phone:"",notes_private:"B private",active:true}')" >/dev/null

echo '3/12 Create two independent groups and enrollments'
COURSE="$(create_record 'courses' "$ADMIN_TOKEN" '{"title":"CI Isolation B1","slug":"ci-isolation-b1","level":"B1","description":"Isolation smoke","status":"ACTIVE","public_visible":false}')"
COURSE_ID="$(jq -r '.id' <<<"$COURSE")"
GROUP_A="$(create_record 'groups' "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_A_ID" '{name:"CI Group A",course:$course,teacher:$teacher,academic_year:"2026/27",schedule_text:"A",capacity:8,target_level:"B1",default_delivery_mode:"IN_PERSON",status:"ACTIVE"}')")"
GROUP_B="$(create_record 'groups' "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_B_ID" '{name:"CI Group B",course:$course,teacher:$teacher,academic_year:"2026/27",schedule_text:"B",capacity:8,target_level:"B1",default_delivery_mode:"ONLINE",status:"ACTIVE"}')")"
GROUP_A_ID="$(jq -r '.id' <<<"$GROUP_A")"
GROUP_B_ID="$(jq -r '.id' <<<"$GROUP_B")"

ENROLLMENT_A="$(create_record 'enrollments' "$ADMIN_TOKEN" "$(jq -nc --arg student "$STUDENT_A_ID" --arg group "$GROUP_A_ID" '{student:$student,group:$group,status:"ACTIVE",joined_at:"2026-08-12 12:00:00.000Z"}')")"
ENROLLMENT_B="$(create_record 'enrollments' "$ADMIN_TOKEN" "$(jq -nc --arg student "$STUDENT_B_ID" --arg group "$GROUP_B_ID" '{student:$student,group:$group,status:"ACTIVE",joined_at:"2026-08-12 12:00:00.000Z"}')")"
ENROLLMENT_A_ID="$(jq -r '.id' <<<"$ENROLLMENT_A")"
ENROLLMENT_B_ID="$(jq -r '.id' <<<"$ENROLLMENT_B")"

echo '4/12 Authenticate all four application users'
TEACHER_A_TOKEN="$(jq -r '.token' <<<"$(authenticate "$TEACHER_A_EMAIL" "$PASSWORD")")"
TEACHER_B_TOKEN="$(jq -r '.token' <<<"$(authenticate "$TEACHER_B_EMAIL" "$PASSWORD")")"
STUDENT_A_TOKEN="$(jq -r '.token' <<<"$(authenticate "$STUDENT_A_EMAIL" "$PASSWORD")")"
STUDENT_B_TOKEN="$(jq -r '.token' <<<"$(authenticate "$STUDENT_B_EMAIL" "$PASSWORD")")"

echo '5/12 Student A can see own academic records but not Student B'
assert_status "$(http_status GET "$PB_URL/api/collections/enrollments/records/$ENROLLMENT_A_ID" "$STUDENT_A_TOKEN")" 200 'Student A reads own enrollment'
assert_denied "$(http_status GET "$PB_URL/api/collections/enrollments/records/$ENROLLMENT_B_ID" "$STUDENT_A_TOKEN")" 'Student A reads Student B enrollment'
assert_denied "$(http_status GET "$PB_URL/api/collections/users/records/$STUDENT_B_ID" "$STUDENT_A_TOKEN")" 'Student A reads Student B user record'
assert_status "$(http_status GET "$PB_URL/api/collections/groups/records/$GROUP_A_ID" "$STUDENT_A_TOKEN")" 200 'Student A reads enrolled group'
assert_denied "$(http_status GET "$PB_URL/api/collections/groups/records/$GROUP_B_ID" "$STUDENT_A_TOKEN")" 'Student A reads unrelated group'

echo '6/12 Teacher A can see Student A and Group A but not B scope'
assert_status "$(http_status GET "$PB_URL/api/collections/users/records/$STUDENT_A_ID" "$TEACHER_A_TOKEN")" 200 'Teacher A reads related Student A'
assert_status "$(http_status GET "$PB_URL/api/collections/groups/records/$GROUP_A_ID" "$TEACHER_A_TOKEN")" 200 'Teacher A reads own Group A'
assert_denied "$(http_status GET "$PB_URL/api/collections/users/records/$STUDENT_B_ID" "$TEACHER_A_TOKEN")" 'Teacher A reads unrelated Student B'
assert_denied "$(http_status GET "$PB_URL/api/collections/groups/records/$GROUP_B_ID" "$TEACHER_A_TOKEN")" 'Teacher A reads Teacher B group'
assert_denied "$(http_status GET "$PB_URL/api/collections/users/records/$STUDENT_A_ID" "$TEACHER_B_TOKEN")" 'Teacher B reads unrelated Student A'

echo '7/12 Create private Student A file with Student A token'
printf '%%PDF-1.4\n%% Language School CI private file A\n' > "$TMP_DIR/private-a.pdf"
FILE_A="$(curl -fsS -X POST "$PB_URL/api/collections/student_files/records" \
  -H "Authorization: $STUDENT_A_TOKEN" \
  -F 'title=CI private file A' \
  -F "student=$STUDENT_A_ID" \
  -F "uploaded_by=$STUDENT_A_ID" \
  -F 'category=DOCUMENT' \
  -F 'description=Isolation smoke' \
  -F 'status=ACTIVE' \
  -F "file=@$TMP_DIR/private-a.pdf;type=application/pdf")"
FILE_A_ID="$(jq -r '.id' <<<"$FILE_A")"
FILE_A_NAME="$(jq -r '.file' <<<"$FILE_A")"

echo '8/12 Private file record visibility is relationship-scoped'
assert_status "$(http_status GET "$PB_URL/api/collections/student_files/records/$FILE_A_ID" "$STUDENT_A_TOKEN")" 200 'Student A reads own file record'
assert_denied "$(http_status GET "$PB_URL/api/collections/student_files/records/$FILE_A_ID" "$STUDENT_B_TOKEN")" 'Student B reads Student A file record'
assert_status "$(http_status GET "$PB_URL/api/collections/student_files/records/$FILE_A_ID" "$TEACHER_A_TOKEN")" 200 'Teacher A reads related Student A file record'
assert_denied "$(http_status GET "$PB_URL/api/collections/student_files/records/$FILE_A_ID" "$TEACHER_B_TOKEN")" 'Teacher B reads unrelated Student A file record'

echo '9/12 Protected file tokens enforce the same viewRule'
get_file_token() {
  local auth_token="$1"
  curl -fsS -X POST "$PB_URL/api/files/token" -H "Authorization: $auth_token" | jq -r '.token'
}

STUDENT_A_FILE_TOKEN="$(get_file_token "$STUDENT_A_TOKEN")"
STUDENT_B_FILE_TOKEN="$(get_file_token "$STUDENT_B_TOKEN")"
TEACHER_A_FILE_TOKEN="$(get_file_token "$TEACHER_A_TOKEN")"
TEACHER_B_FILE_TOKEN="$(get_file_token "$TEACHER_B_TOKEN")"
FILE_URL="$PB_URL/api/files/student_files/$FILE_A_ID/$FILE_A_NAME"

file_status() {
  local token="$1"
  curl -sS -o "$TMP_DIR/download-body" -w '%{http_code}' "$FILE_URL?token=$token"
}

assert_status "$(file_status "$STUDENT_A_FILE_TOKEN")" 200 'Student A downloads own protected file'
assert_denied "$(file_status "$STUDENT_B_FILE_TOKEN")" 'Student B downloads Student A protected file'
assert_status "$(file_status "$TEACHER_A_FILE_TOKEN")" 200 'Teacher A downloads related Student A protected file'
assert_denied "$(file_status "$TEACHER_B_FILE_TOKEN")" 'Teacher B downloads unrelated Student A protected file'

echo '10/12 Teacher attendance is constrained to the class group'
CLASS_A="$(create_record 'classes' "$ADMIN_TOKEN" "$(jq -nc --arg group "$GROUP_A_ID" --arg teacher "$TEACHER_A_ID" '{group:$group,teacher:$teacher,starts_at:"2026-08-14 18:00:00.000Z",ends_at:"2026-08-14 19:00:00.000Z",topic:"Isolation lesson A",description:"",status:"SCHEDULED"}')")"
CLASS_A_ID="$(jq -r '.id' <<<"$CLASS_A")"
GOOD_ATTENDANCE_STATUS="$(curl -sS -o "$TMP_DIR/good-attendance" -w '%{http_code}' -X POST "$PB_URL/api/collections/attendance/records" \
  -H 'Content-Type: application/json' -H "Authorization: $TEACHER_A_TOKEN" \
  --data "$(jq -nc --arg class "$CLASS_A_ID" --arg student "$STUDENT_A_ID" '{class:$class,student:$student,status:"PRESENT",notes:"Allowed"}')")"
assert_status "$GOOD_ATTENDANCE_STATUS" 200 'Teacher A registers attendance for Student A in Group A'

BAD_ATTENDANCE_STATUS="$(curl -sS -o "$TMP_DIR/bad-attendance" -w '%{http_code}' -X POST "$PB_URL/api/collections/attendance/records" \
  -H 'Content-Type: application/json' -H "Authorization: $TEACHER_A_TOKEN" \
  --data "$(jq -nc --arg class "$CLASS_A_ID" --arg student "$STUDENT_B_ID" '{class:$class,student:$student,status:"PRESENT",notes:"Must fail"}')")"
assert_denied "$BAD_ATTENDANCE_STATUS" 'Teacher A registers attendance for Student B outside Group A'

echo '11/12 Teacher authoring cannot target an unrelated student'
BAD_MATERIAL_STATUS="$(curl -sS -o "$TMP_DIR/bad-material" -w '%{http_code}' -X POST "$PB_URL/api/collections/materials/records" \
  -H "Authorization: $TEACHER_A_TOKEN" \
  -F 'title=Forbidden material' \
  -F "teacher=$TEACHER_A_ID" \
  -F "student=$STUDENT_B_ID" \
  -F 'visibility=STUDENT' \
  -F 'published=true' \
  -F "file=@$TMP_DIR/private-a.pdf;type=application/pdf")"
assert_denied "$BAD_MATERIAL_STATUS" 'Teacher A publishes material to unrelated Student B'

echo '12/12 Relationship removal immediately revokes teacher file access'
curl -fsS -X PATCH "$PB_URL/api/collections/enrollments/records/$ENROLLMENT_A_ID" \
  -H 'Content-Type: application/json' -H "Authorization: $ADMIN_TOKEN" \
  --data '{"status":"PAUSED"}' >/dev/null
assert_denied "$(http_status GET "$PB_URL/api/collections/student_files/records/$FILE_A_ID" "$TEACHER_A_TOKEN")" 'Teacher A reads Student A file after enrollment pause'
NEW_TEACHER_A_FILE_TOKEN="$(get_file_token "$TEACHER_A_TOKEN")"
assert_denied "$(file_status "$NEW_TEACHER_A_FILE_TOKEN")" 'Teacher A downloads Student A file after enrollment pause'

echo 'SECURITY ISOLATION SMOKE TEST: SUCCESS'
