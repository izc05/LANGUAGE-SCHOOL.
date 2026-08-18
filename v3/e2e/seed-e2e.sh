#!/usr/bin/env bash
set -euo pipefail

PB_URL="${PB_URL:-http://127.0.0.1:8090}"
SUPERUSER_EMAIL="${PB_SUPERUSER_EMAIL:-e2e-superuser@example.com}"
SUPERUSER_PASSWORD="${PB_SUPERUSER_PASSWORD:-E2eSuperuserPass123!}"
ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-e2e-admin@example.com}"
ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-E2eAdminPass123!}"
TEACHER_EMAIL="${E2E_TEACHER_EMAIL:-e2e-teacher@example.com}"
TEACHER_PASSWORD="${E2E_TEACHER_PASSWORD:-E2eTeacherPass123!}"
STUDENT_EMAIL="${E2E_STUDENT_EMAIL:-e2e-student@example.com}"
STUDENT_PASSWORD="${E2E_STUDENT_PASSWORD:-E2eStudentPass123!}"

post_json() {
  local url="$1" token="$2" body="$3"
  if [[ -n "$token" ]]; then
    curl -fsS -X POST "$url" -H 'Content-Type: application/json' -H "Authorization: $token" --data "$body"
  else
    curl -fsS -X POST "$url" -H 'Content-Type: application/json' --data "$body"
  fi
}

patch_json() {
  local url="$1" token="$2" body="$3"
  curl -fsS -X PATCH "$url" -H 'Content-Type: application/json' -H "Authorization: $token" --data "$body"
}

authenticate() {
  post_json "$PB_URL/api/collections/$1/auth-with-password" '' \
    "$(jq -nc --arg identity "$2" --arg password "$3" '{identity:$identity,password:$password}')"
}

create_record() {
  post_json "$PB_URL/api/collections/$1/records" "$2" "$3"
}

echo 'E2E seed: authenticating superuser'
SUPER_AUTH="$(authenticate '_superusers' "$SUPERUSER_EMAIL" "$SUPERUSER_PASSWORD")"
SUPER_TOKEN="$(jq -r '.token' <<<"$SUPER_AUTH")"

echo 'E2E seed: creating application ADMIN'
ADMIN="$(create_record 'users' "$SUPER_TOKEN" "$(jq -nc --arg email "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" '{email:$email,password:$password,passwordConfirm:$password,name:"E2E",surname:"Admin",role:"ADMIN",status:"ACTIVE",phone:""}')")"
ADMIN_ID="$(jq -r '.id' <<<"$ADMIN")"
ADMIN_AUTH="$(authenticate 'users' "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
ADMIN_TOKEN="$(jq -r '.token' <<<"$ADMIN_AUTH")"

echo 'E2E seed: setting academy public identity'
SITE_SETTINGS="$(curl -fsS "$PB_URL/api/collections/site_settings/records?perPage=1" -H "Authorization: $ADMIN_TOKEN")"
SITE_SETTINGS_ID="$(jq -r '.items[0].id' <<<"$SITE_SETTINGS")"
patch_json "$PB_URL/api/collections/site_settings/records/$SITE_SETTINGS_ID" "$ADMIN_TOKEN" '{"academy_name":"E2E Language Academy","phone":"","email":"","whatsapp":"618218187","address":"Test Academy Address","social_links":{"whatsapp_enabled":"true","whatsapp_message":"Hola desde E2E"},"legal_texts":{"cookie_banner_enabled":"true","cookie_intro":"E2E cookie preferences"}}' >/dev/null

echo 'E2E seed: creating teacher and safe public teacher profile'
TEACHER="$(create_record 'users' "$ADMIN_TOKEN" "$(jq -nc --arg email "$TEACHER_EMAIL" --arg password "$TEACHER_PASSWORD" '{email:$email,password:$password,passwordConfirm:$password,name:"E2E",surname:"Teacher",role:"TEACHER",status:"ACTIVE",phone:""}')")"
TEACHER_ID="$(jq -r '.id' <<<"$TEACHER")"
create_record 'teacher_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$TEACHER_ID" '{user:$user,bio:"Perfil público creado para la prueba real de navegador.",specialties:["B1","Speaking"],public_profile:true,active:true,display_name:"E2E Public Teacher",headline:"English Teacher · B1 & Speaking",sort_order:10}')" >/dev/null

STUDENT="$(create_record 'users' "$ADMIN_TOKEN" "$(jq -nc --arg email "$STUDENT_EMAIL" --arg password "$STUDENT_PASSWORD" '{email:$email,password:$password,passwordConfirm:$password,name:"E2E",surname:"Student",role:"STUDENT",status:"ACTIVE",phone:""}')")"
STUDENT_ID="$(jq -r '.id' <<<"$STUDENT")"
create_record 'student_profiles' "$ADMIN_TOKEN" "$(jq -nc --arg user "$STUDENT_ID" '{user:$user,guardian_name:"",guardian_phone:"",notes_private:"",active:true}')" >/dev/null

echo 'E2E seed: creating academic chain'
COURSE="$(create_record 'courses' "$ADMIN_TOKEN" '{"title":"E2E English B1","slug":"e2e-english-b1","level":"B1","description":"Browser test course","status":"ACTIVE","public_visible":true}')"
COURSE_ID="$(jq -r '.id' <<<"$COURSE")"
GROUP="$(create_record 'groups' "$ADMIN_TOKEN" "$(jq -nc --arg course "$COURSE_ID" --arg teacher "$TEACHER_ID" '{name:"E2E B1 Group",course:$course,teacher:$teacher,academic_year:"2026/27",schedule_text:"Thursday 18:00",capacity:8,status:"ACTIVE"}')")"
GROUP_ID="$(jq -r '.id' <<<"$GROUP")"
create_record 'enrollments' "$ADMIN_TOKEN" "$(jq -nc --arg student "$STUDENT_ID" --arg group "$GROUP_ID" '{student:$student,group:$group,status:"ACTIVE",joined_at:"2026-08-12 10:00:00.000Z"}')" >/dev/null

CLASS="$(create_record 'classes' "$ADMIN_TOKEN" "$(jq -nc --arg group "$GROUP_ID" --arg teacher "$TEACHER_ID" '{group:$group,teacher:$teacher,starts_at:"2026-12-10 18:00:00.000Z",ends_at:"2026-12-10 19:00:00.000Z",topic:"E2E Speaking class",description:"Browser test",status:"SCHEDULED",delivery_mode:"HYBRID",location_text:"Aula E2E",online_join_url:"https://example.com/e2e-language-class"}')")"
CLASS_ID="$(jq -r '.id' <<<"$CLASS")"
create_record 'zoom_meetings' "$ADMIN_TOKEN" "$(jq -nc --arg classId "$CLASS_ID" --arg admin "$ADMIN_ID" '{class:$classId,provider:"ZOOM",external_meeting_id:"98765432100",external_uuid:"e2e-zoom-uuid",join_url:"https://example.com/e2e-language-class",status:"READY",created_by:$admin}')" >/dev/null

ZOOM_CREATE_CLASS="$(create_record 'classes' "$ADMIN_TOKEN" "$(jq -nc --arg group "$GROUP_ID" --arg teacher "$TEACHER_ID" '{group:$group,teacher:$teacher,starts_at:"2026-12-17 18:00:00.000Z",ends_at:"2026-12-17 19:15:00.000Z",topic:"E2E Zoom create class",description:"Forces the complete mocked Zoom creation path",status:"SCHEDULED",delivery_mode:"ONLINE",location_text:"",online_join_url:""}')")"
ZOOM_CREATE_CLASS_ID="$(jq -r '.id' <<<"$ZOOM_CREATE_CLASS")"

echo 'E2E seed: publishing a real pricing plan'
create_record 'pricing_plans' "$ADMIN_TOKEN" '{"name":"E2E Monthly","description":"Tarifa publicada por la prueba de navegador.","price":45,"billing_text":"al mes","features":["Clases","Material","Seguimiento"],"sort_order":10,"active":true,"featured":true}' >/dev/null

echo "E2E seed complete: admin=$ADMIN_ID teacher=$TEACHER_ID student=$STUDENT_ID group=$GROUP_ID zoom_create_class=$ZOOM_CREATE_CLASS_ID"
