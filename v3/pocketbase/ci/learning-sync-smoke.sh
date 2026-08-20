#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
ADMIN_EMAIL="ci-admin@example.com"
ADMIN_PASSWORD="CiAdminPass123!"
PASSWORD="CiLearningSyncPass123!"
TMP_DIR="${RUNNER_TEMP:-/tmp}/language-school-learning-sync"
mkdir -p "$TMP_DIR"

post_json() {
  local url="$1" token="$2" body="$3"
  local response_file status
  response_file="$(mktemp)"
  status="$(curl -sS -o "$response_file" -w '%{http_code}' -X POST "$url" \
    -H 'Content-Type: application/json' \
    -H "Authorization: $token" \
    --data "$body")"
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
  local email="$1" password="$2"
  curl -fsS -X POST "$PB_URL/api/collections/users/auth-with-password" \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg identity "$email" --arg password "$password" '{identity:$identity,password:$password}')"
}

create_record() {
  local collection="$1" token="$2" body="$3"
  post_json "$PB_URL/api/collections/$collection/records" "$token" "$body"
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

echo '1/10 Authenticate ADMIN and create learning-sync actors'
ADMIN_AUTH="$(authenticate "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
ADMIN_TOKEN="$(jq -r '.token' <<<"$ADMIN_AUTH")"
test -n "$ADMIN_TOKEN" && test "$ADMIN_TOKEN" != 'null'

TEACHER_A_EMAIL='ci-learning-teacher-a@example.com'
TEACHER_B_EMAIL='ci-learning-teacher-b@example.com'
STUDENT_EMAIL='ci-learning-student@example.com'

TEACHER_A="$(create_user "$ADMIN_TOKEN" "$TEACHER_A_EMAIL" 'TEACHER' 'LearningTeacherA')"
TEACHER_B="$(create_user "$ADMIN_TOKEN" "$TEACHER_B_EMAIL" 'TEACHER' 'LearningTeacherB')"
STUDENT="$(create_user "$ADMIN_TOKEN" "$STUDENT_EMAIL" 'STUDENT' 'LearningStudent')"
TEACHER_A_ID="$(jq -r '.id' <<<"$TEACHER_A")"
TEACHER_B_ID="$(jq -r '.id' <<<"$TEACHER_B")"
STUDENT_ID="$(jq -r '.id' <<<"$STUDENT")"

create_record 'teacher_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$TEACHER_A_ID" '{user:$user,bio:"Learning A",specialties:["B1"],public_profile:false,active:true}')" >/dev/null
create_record 'teacher_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$TEACHER_B_ID" '{user:$user,bio:"Learning B",specialties:["B1"],public_profile:false,active:true}')" >/dev/null
create_record 'student_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$STUDENT_ID" '{user:$user,guardian_name:"",guardian_phone:"",notes_private:"",active:true}')" >/dev/null

TEACHER_A_TOKEN="$(jq -r '.token' <<<"$(authenticate "$TEACHER_A_EMAIL" "$PASSWORD")")"
TEACHER_B_TOKEN="$(jq -r '.token' <<<"$(authenticate "$TEACHER_B_EMAIL" "$PASSWORD")")"
STUDENT_TOKEN="$(jq -r '.token' <<<"$(authenticate "$STUDENT_EMAIL" "$PASSWORD")")"

echo '2/10 Create course, Group A/B and initial ACTIVE enrollment in Group A'
COURSE="$(create_record 'courses' "$ADMIN_TOKEN" '{"title":"CI Learning Sync B1","slug":"ci-learning-sync-b1","level":"B1","description":"Learning synchronization smoke","status":"ACTIVE","public_visible":false}')"
COURSE_ID="$(jq -r '.id' <<<"$COURSE")"
GROUP_A="$(create_record 'groups' "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_A_ID" '{name:"CI Learning Group A",course:$course,teacher:$teacher,academic_year:"2026/27",schedule_text:"A",capacity:8,target_level:"B1",default_delivery_mode:"IN_PERSON",status:"ACTIVE"}')")"
GROUP_B="$(create_record 'groups' "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_B_ID" '{name:"CI Learning Group B",course:$course,teacher:$teacher,academic_year:"2026/27",schedule_text:"B",capacity:8,target_level:"B1",default_delivery_mode:"IN_PERSON",status:"ACTIVE"}')")"
GROUP_A_ID="$(jq -r '.id' <<<"$GROUP_A")"
GROUP_B_ID="$(jq -r '.id' <<<"$GROUP_B")"
OLD_ENROLLMENT="$(create_record 'enrollments' "$ADMIN_TOKEN" "$(jq -nc --arg student "$STUDENT_ID" --arg group "$GROUP_A_ID" '{student:$student,group:$group,status:"ACTIVE",joined_at:"2026-08-20 09:00:00.000Z"}')")"
OLD_ENROLLMENT_ID="$(jq -r '.id' <<<"$OLD_ENROLLMENT")"

printf '%%PDF-1.4\n%% Language School learning sync\n' > "$TMP_DIR/material.pdf"

echo '3/10 Teacher A publishes group material, direct material and group assignment'
GROUP_MATERIAL="$(curl -fsS -X POST "$PB_URL/api/collections/materials/records" \
  -H "Authorization: $TEACHER_A_TOKEN" \
  -F 'title=CI Group A material' \
  -F 'description=Current group resource' \
  -F "teacher=$TEACHER_A_ID" \
  -F "group=$GROUP_A_ID" \
  -F 'visibility=GROUP' \
  -F 'published=true' \
  -F "file=@$TMP_DIR/material.pdf;type=application/pdf")"
GROUP_MATERIAL_ID="$(jq -r '.id' <<<"$GROUP_MATERIAL")"

DIRECT_MATERIAL="$(curl -fsS -X POST "$PB_URL/api/collections/materials/records" \
  -H "Authorization: $TEACHER_A_TOKEN" \
  -F 'title=CI Direct student material' \
  -F 'description=Personal historical resource' \
  -F "teacher=$TEACHER_A_ID" \
  -F "student=$STUDENT_ID" \
  -F 'visibility=STUDENT' \
  -F 'published=true' \
  -F "file=@$TMP_DIR/material.pdf;type=application/pdf")"
DIRECT_MATERIAL_ID="$(jq -r '.id' <<<"$DIRECT_MATERIAL")"

ASSIGNMENT="$(create_record 'assignments' "$TEACHER_A_TOKEN" "$(jq -nc --arg teacher "$TEACHER_A_ID" --arg group "$GROUP_A_ID" '{title:"CI Group A assignment",description:"Historical task",teacher:$teacher,group:$group,due_at:"2026-09-15 18:00:00.000Z",status:"PUBLISHED"}')")"
ASSIGNMENT_ID="$(jq -r '.id' <<<"$ASSIGNMENT")"

echo '4/10 Student sees current Group A learning content and submits assignment'
assert_status "$(http_status GET "$PB_URL/api/collections/materials/records/$GROUP_MATERIAL_ID" "$STUDENT_TOKEN")" 200 'Student reads current Group A material'
assert_status "$(http_status GET "$PB_URL/api/collections/materials/records/$DIRECT_MATERIAL_ID" "$STUDENT_TOKEN")" 200 'Student reads direct material'
assert_status "$(http_status GET "$PB_URL/api/collections/assignments/records/$ASSIGNMENT_ID" "$STUDENT_TOKEN")" 200 'Student reads current Group A assignment'

SUBMISSION="$(create_record 'assignment_submissions' "$STUDENT_TOKEN" "$(jq -nc --arg assignment "$ASSIGNMENT_ID" --arg student "$STUDENT_ID" '{assignment:$assignment,student:$student,text_answer:"CI answer before group move",submitted_at:"2026-08-20 10:00:00.000Z",status:"SUBMITTED"}')")"
SUBMISSION_ID="$(jq -r '.id' <<<"$SUBMISSION")"
assert_status "$(http_status GET "$PB_URL/api/collections/assignment_submissions/records/$SUBMISSION_ID" "$STUDENT_TOKEN")" 200 'Student reads own submission'

echo '5/10 Student creates private file; Teacher A has current relationship access'
printf '%%PDF-1.4\n%% Student private historical file\n' > "$TMP_DIR/student-file.pdf"
STUDENT_FILE="$(curl -fsS -X POST "$PB_URL/api/collections/student_files/records" \
  -H "Authorization: $STUDENT_TOKEN" \
  -F 'title=CI learning private file' \
  -F "student=$STUDENT_ID" \
  -F "uploaded_by=$STUDENT_ID" \
  -F 'category=DOCUMENT' \
  -F 'description=Teacher relationship transfer check' \
  -F 'status=ACTIVE' \
  -F "file=@$TMP_DIR/student-file.pdf;type=application/pdf")"
STUDENT_FILE_ID="$(jq -r '.id' <<<"$STUDENT_FILE")"
assert_status "$(http_status GET "$PB_URL/api/collections/student_files/records/$STUDENT_FILE_ID" "$TEACHER_A_TOKEN")" 200 'Teacher A reads current student file'
assert_denied "$(http_status GET "$PB_URL/api/collections/student_files/records/$STUDENT_FILE_ID" "$TEACHER_B_TOKEN")" 'Teacher B reads student file before move'

echo '6/10 ADMIN moves student atomically from Group A to Group B'
MOVE_RESPONSE="$(post_json "$PB_URL/api/language-school/admin/academic/enrollments/move" "$ADMIN_TOKEN" "$(jq -nc --arg studentId "$STUDENT_ID" --arg targetGroupId "$GROUP_B_ID" '{studentId:$studentId,targetGroupId:$targetGroupId}')")"
NEW_ENROLLMENT_ID="$(jq -r '.currentId' <<<"$MOVE_RESPONSE")"
test -n "$NEW_ENROLLMENT_ID" && test "$NEW_ENROLLMENT_ID" != 'null'

OLD_AFTER="$(curl -fsS "$PB_URL/api/collections/enrollments/records/$OLD_ENROLLMENT_ID" -H "Authorization: $ADMIN_TOKEN")"
NEW_AFTER="$(curl -fsS "$PB_URL/api/collections/enrollments/records/$NEW_ENROLLMENT_ID" -H "Authorization: $ADMIN_TOKEN")"
[[ "$(jq -r '.status' <<<"$OLD_AFTER")" == 'FINISHED' ]]
[[ "$(jq -r '.status' <<<"$NEW_AFTER")" == 'ACTIVE' ]]
[[ "$(jq -r '.group' <<<"$NEW_AFTER")" == "$GROUP_B_ID" ]]
ACTIVE_LIST="$(curl -fsS -G "$PB_URL/api/collections/enrollments/records" \
  -H "Authorization: $ADMIN_TOKEN" \
  --data-urlencode "filter=student = \"$STUDENT_ID\" && status = \"ACTIVE\"")"
[[ "$(jq -r '.totalItems' <<<"$ACTIVE_LIST")" == '1' ]]
echo 'OK: move leaves exactly one ACTIVE enrollment and preserves FINISHED history'

echo '7/10 Old group access is revoked, but direct/history already owned by student remains'
assert_denied "$(http_status GET "$PB_URL/api/collections/materials/records/$GROUP_MATERIAL_ID" "$STUDENT_TOKEN")" 'Student reads old Group A material after move'
assert_status "$(http_status GET "$PB_URL/api/collections/materials/records/$DIRECT_MATERIAL_ID" "$STUDENT_TOKEN")" 200 'Student keeps direct personal material after move'
assert_status "$(http_status GET "$PB_URL/api/collections/assignments/records/$ASSIGNMENT_ID" "$STUDENT_TOKEN")" 200 'Student keeps submitted historical assignment after move'
assert_status "$(http_status GET "$PB_URL/api/collections/assignment_submissions/records/$SUBMISSION_ID" "$STUDENT_TOKEN")" 200 'Student keeps own historical submission after move'

echo '8/10 Teacher relationship transfers from A to B'
assert_denied "$(http_status GET "$PB_URL/api/collections/student_files/records/$STUDENT_FILE_ID" "$TEACHER_A_TOKEN")" 'Teacher A loses student file after move'
assert_status "$(http_status GET "$PB_URL/api/collections/student_files/records/$STUDENT_FILE_ID" "$TEACHER_B_TOKEN")" 200 'Teacher B gains current student file after move'

echo '9/10 New content in old Group A is no longer visible to moved student'
NEW_OLD_ASSIGNMENT="$(create_record 'assignments' "$TEACHER_A_TOKEN" "$(jq -nc --arg teacher "$TEACHER_A_ID" --arg group "$GROUP_A_ID" '{title:"CI New old-group assignment",description:"Must stay in Group A",teacher:$teacher,group:$group,due_at:"2026-09-20 18:00:00.000Z",status:"PUBLISHED"}')")"
NEW_OLD_ASSIGNMENT_ID="$(jq -r '.id' <<<"$NEW_OLD_ASSIGNMENT")"
assert_denied "$(http_status GET "$PB_URL/api/collections/assignments/records/$NEW_OLD_ASSIGNMENT_ID" "$STUDENT_TOKEN")" 'Student reads new Group A assignment after move'

NEW_OLD_MATERIAL="$(curl -fsS -X POST "$PB_URL/api/collections/materials/records" \
  -H "Authorization: $TEACHER_A_TOKEN" \
  -F 'title=CI New old-group material' \
  -F "teacher=$TEACHER_A_ID" \
  -F "group=$GROUP_A_ID" \
  -F 'visibility=GROUP' \
  -F 'published=true' \
  -F "file=@$TMP_DIR/material.pdf;type=application/pdf")"
NEW_OLD_MATERIAL_ID="$(jq -r '.id' <<<"$NEW_OLD_MATERIAL")"
assert_denied "$(http_status GET "$PB_URL/api/collections/materials/records/$NEW_OLD_MATERIAL_ID" "$STUDENT_TOKEN")" 'Student reads new Group A material after move'

echo '10/10 Student can read new Group B and Teacher B can author current content'
assert_status "$(http_status GET "$PB_URL/api/collections/groups/records/$GROUP_B_ID" "$STUDENT_TOKEN")" 200 'Student reads new Group B'
NEW_GROUP_B_ASSIGNMENT="$(create_record 'assignments' "$TEACHER_B_TOKEN" "$(jq -nc --arg teacher "$TEACHER_B_ID" --arg group "$GROUP_B_ID" '{title:"CI Group B current assignment",description:"Current task",teacher:$teacher,group:$group,due_at:"2026-09-22 18:00:00.000Z",status:"PUBLISHED"}')")"
NEW_GROUP_B_ASSIGNMENT_ID="$(jq -r '.id' <<<"$NEW_GROUP_B_ASSIGNMENT")"
assert_status "$(http_status GET "$PB_URL/api/collections/assignments/records/$NEW_GROUP_B_ASSIGNMENT_ID" "$STUDENT_TOKEN")" 200 'Student reads current Group B assignment'

echo 'LEARNING SYNCHRONIZATION SMOKE TEST: SUCCESS'
