#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
V3_INFRA_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PREFLIGHT="$V3_INFRA_DIR/raspberry-pi/preflight-update.sh"
START_PB="$V3_INFRA_DIR/raspberry-pi/start-pocketbase.sh"
DEPLOY_FRONTEND="$V3_INFRA_DIR/raspberry-pi/deploy-frontend.sh"
TEST_SITE='1x00000000000000000000AA'
TEST_SECRET='1x0000000000000000000000000000000AA'
TMP_DIR="$(mktemp -d)"
BACKUP_MOUNT_PATH="$TMP_DIR/test-backup"
trap 'rm -rf "$TMP_DIR"' EXIT

pass_count=0
pass() {
  printf 'PASS %s\n' "$1"
  pass_count=$((pass_count + 1))
}

fail_test() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

expect_success() {
  local label="$1" output_file="$2"
  shift 2
  if "$@" >"$output_file" 2>&1; then
    pass "$label"
  else
    sed -n '1,220p' "$output_file" >&2
    fail_test "$label"
  fi
}

expect_failure() {
  local label="$1" output_file="$2" expected="$3"
  shift 3
  if "$@" >"$output_file" 2>&1; then
    sed -n '1,220p' "$output_file" >&2
    fail_test "$label unexpectedly succeeded"
  fi
  if ! grep -Fq "$expected" "$output_file"; then
    sed -n '1,220p' "$output_file" >&2
    fail_test "$label did not report: $expected"
  fi
  pass "$label"
}

FIXTURE_REPO="$TMP_DIR/repo"
mkdir -p \
  "$FIXTURE_REPO/v3/pocketbase/pb_migrations" \
  "$FIXTURE_REPO/v3/pocketbase/pb_hooks" \
  "$FIXTURE_REPO/v3/frontend"
touch \
  "$FIXTURE_REPO/v3/pocketbase/pb_migrations/.keep" \
  "$FIXTURE_REPO/v3/pocketbase/pb_hooks/.keep" \
  "$FIXTURE_REPO/v3/frontend/package.json"
git -C "$FIXTURE_REPO" init -q -b design/home-premium-v2
git -C "$FIXTURE_REPO" config user.name 'Infrastructure CI'
git -C "$FIXTURE_REPO" config user.email 'infra-ci@example.invalid'
git -C "$FIXTURE_REPO" add .
git -C "$FIXTURE_REPO" commit -qm fixture
FIXTURE_SHA="$(git -C "$FIXTURE_REPO" rev-parse HEAD)"

write_env() {
  local file="$1" mode="$2" smtp_enabled="$3" site_key="$4" secret_key="$5"
  local hostnames="$6" pb_url="$7" proxy_url="$8"
  {
    if [[ "$mode" != 'unset' ]]; then printf 'DEPLOYMENT_MODE=%s\n' "$mode"; fi
    printf '%s\n' \
      'PUBLIC_ORIGIN=https://pilot.example.org' \
      "PB_URL=$pb_url" \
      "PROXY_URL=$proxy_url" \
      "BACKUP_MOUNT=$BACKUP_MOUNT_PATH" \
      "SMTP_ENABLED=$smtp_enabled" \
      'SMTP_HOST=smtp.test-provider.invalid' \
      'SMTP_USERNAME=test-user' \
      'SMTP_PASSWORD=test-password' \
      'SMTP_SENDER_ADDRESS=test@pilot.example.org' \
      "TURNSTILE_SITE_KEY=$site_key" \
      "TURNSTILE_SECRET_KEY=$secret_key" \
      'TURNSTILE_EXPECTED_ACTION=contact' \
      "TURNSTILE_ALLOWED_HOSTNAMES=$hostnames"
  } >"$file"
}

run_preflight() {
  local env_file="$1"
  env -u DEPLOYMENT_MODE \
    PRODUCTION_ENV="$env_file" \
    REPO_DIR="$FIXTURE_REPO" \
    EXPECTED_SHA="$FIXTURE_SHA" \
    EXPECTED_BRANCH='design/home-premium-v2' \
    EXPECTED_PUBLIC_ORIGIN='https://pilot.example.org' \
    HOST_CHECKS=0 CHECK_PUBLIC=0 \
    bash "$PREFLIGHT"
}

PRODUCTION_ENV_FILE="$TMP_DIR/production.env"
write_env "$PRODUCTION_ENV_FILE" production false real-site real-secret pilot.example.org \
  http://127.0.0.1:8091 http://127.0.0.1:8083
expect_failure 'production rejects missing SMTP' "$TMP_DIR/prod-smtp.log" \
  'SMTP_ENABLED must be true' run_preflight "$PRODUCTION_ENV_FILE"

write_env "$PRODUCTION_ENV_FILE" production true "$TEST_SITE" "$TEST_SECRET" pilot.example.org \
  http://127.0.0.1:8091 http://127.0.0.1:8083
expect_failure 'production rejects official Turnstile test keys' "$TMP_DIR/prod-turnstile.log" \
  'Turnstile production site key is the official test key' run_preflight "$PRODUCTION_ENV_FILE"

write_env "$PRODUCTION_ENV_FILE" production true real-site real-secret other.example.org \
  http://127.0.0.1:8091 http://127.0.0.1:8083
expect_failure 'production requires the public Turnstile hostname' "$TMP_DIR/prod-hostname.log" \
  'Turnstile hostname allowlist does not contain PUBLIC_ORIGIN host' run_preflight "$PRODUCTION_ENV_FILE"

write_env "$PRODUCTION_ENV_FILE" pilot false "$TEST_SITE" "$TEST_SECRET" '' \
  http://127.0.0.1:8091 http://127.0.0.1:8083
expect_success 'pilot permits disabled SMTP and official Turnstile test keys' "$TMP_DIR/pilot-ready.log" \
  run_preflight "$PRODUCTION_ENV_FILE"
grep -Fq 'Deployment mode: PILOT' "$TMP_DIR/pilot-ready.log" || fail_test 'pilot mode was not reported'
grep -Fq 'ADMIN email MFA, invitations and password recovery cannot be tested yet' "$TMP_DIR/pilot-ready.log" || fail_test 'pilot SMTP limitation was not reported'

write_env "$PRODUCTION_ENV_FILE" pilot false "$TEST_SITE" "$TEST_SECRET" '' \
  http://0.0.0.0:8091 http://127.0.0.1:8083
expect_failure 'pilot rejects an external PB_URL' "$TMP_DIR/pilot-pb-url.log" \
  'PB_URL must use http://127.0.0.1:<port>' run_preflight "$PRODUCTION_ENV_FILE"

write_env "$PRODUCTION_ENV_FILE" pilot false "$TEST_SITE" "$TEST_SECRET" '' \
  http://127.0.0.1:8091 http://0.0.0.0:8083
expect_failure 'pilot rejects an external PROXY_URL' "$TMP_DIR/pilot-proxy-url.log" \
  'PROXY_URL must use http://127.0.0.1:<port>' run_preflight "$PRODUCTION_ENV_FILE"

write_env "$PRODUCTION_ENV_FILE" unset true "$TEST_SITE" "$TEST_SECRET" pilot.example.org \
  http://127.0.0.1:8091 http://127.0.0.1:8083
expect_failure 'an absent mode defaults to fail-closed production' "$TMP_DIR/default-production.log" \
  'Turnstile production site key is the official test key' run_preflight "$PRODUCTION_ENV_FILE"

MOCK_BIN="$TMP_DIR/mock-bin"
PB_RUNTIME="$TMP_DIR/runtime"
FRONTEND_TARGET="$TMP_DIR/frontend"
mkdir -p "$MOCK_BIN" "$PB_RUNTIME/pb_migrations" "$FRONTEND_TARGET" "$BACKUP_MOUNT_PATH"
touch "$PB_RUNTIME/pocketbase" "$FRONTEND_TARGET/index.html"
chmod +x "$PB_RUNTIME/pocketbase"

for command in systemctl mountpoint; do
  printf '#!/usr/bin/env bash\nexit 0\n' >"$MOCK_BIN/$command"
  chmod +x "$MOCK_BIN/$command"
done
printf '%s\n' '#!/usr/bin/env bash' \
  "printf '%s\\n' 'LISTEN 0 128 127.0.0.1:8091 0.0.0.0:*' 'LISTEN 0 128 127.0.0.1:8083 0.0.0.0:*'" \
  >"$MOCK_BIN/ss"
printf '%s\n' '#!/usr/bin/env bash' "printf '%s\\n' 'root:root 640'" >"$MOCK_BIN/stat"
printf '%s\n' '#!/usr/bin/env bash' \
  'for arg in "$@"; do' \
  "  if [[ \"\$arg\" == '%{http_code}' ]]; then printf '%s' \"\${FAKE_ADMIN_STATUS:-404}\"; fi" \
  'done' \
  'exit 0' >"$MOCK_BIN/curl"
chmod +x "$MOCK_BIN/ss" "$MOCK_BIN/stat" "$MOCK_BIN/curl"

run_host_preflight() {
  local admin_status="$1"
  FAKE_ADMIN_STATUS="$admin_status" PATH="$MOCK_BIN:$PATH" \
    PRODUCTION_ENV="$PRODUCTION_ENV_FILE" \
    REPO_DIR="$FIXTURE_REPO" \
    EXPECTED_SHA="$FIXTURE_SHA" \
    EXPECTED_BRANCH='design/home-premium-v2' \
    EXPECTED_PUBLIC_ORIGIN='https://pilot.example.org' \
    PB_RUNTIME_DIR="$PB_RUNTIME" \
    FRONTEND_TARGET="$FRONTEND_TARGET" \
    HOST_CHECKS=1 CHECK_PUBLIC=1 \
    bash "$PREFLIGHT"
}

write_env "$PRODUCTION_ENV_FILE" pilot false "$TEST_SITE" "$TEST_SECRET" '' \
  http://127.0.0.1:8091 http://127.0.0.1:8083
expect_success 'legacy pb_hooks is WARN before the physical backup' "$TMP_DIR/legacy-hooks.log" \
  run_host_preflight 404
grep -Fq 'installed PocketBase runtime predates pb_hooks' "$TMP_DIR/legacy-hooks.log" || fail_test 'legacy pb_hooks warning was not reported'

expect_failure 'pilot still blocks an exposed PocketBase admin UI' "$TMP_DIR/admin-ui.log" \
  'PocketBase admin UI is blocked locally' run_host_preflight 200

PB_HOOKS="$FIXTURE_REPO/v3/pocketbase/pb_hooks"
expect_failure 'production start wrapper remains fail-closed' "$TMP_DIR/start-production.log" \
  'SMTP_ENABLED=true is required in production' \
  env DEPLOYMENT_MODE=production SMTP_ENABLED=false \
    PB_URL=http://127.0.0.1:8091 PUBLIC_ORIGIN=https://pilot.example.org \
    TURNSTILE_SITE_KEY="$TEST_SITE" TURNSTILE_SECRET_KEY="$TEST_SECRET" \
    TURNSTILE_EXPECTED_ACTION=contact PB_BIN=/usr/bin/echo PB_HOOKS="$PB_HOOKS" \
    bash "$START_PB"

expect_success 'pilot start wrapper accepts the explicit test profile' "$TMP_DIR/start-pilot.log" \
  env DEPLOYMENT_MODE=pilot SMTP_ENABLED=false \
    PB_URL=http://127.0.0.1:8091 PUBLIC_ORIGIN=https://pilot.example.org \
    TURNSTILE_SITE_KEY="$TEST_SITE" TURNSTILE_SECRET_KEY="$TEST_SECRET" \
    TURNSTILE_EXPECTED_ACTION=contact PB_BIN=/usr/bin/echo PB_HOOKS="$PB_HOOKS" \
    bash "$START_PB"
grep -Fq -- '--http=127.0.0.1:8091' "$TMP_DIR/start-pilot.log" || fail_test 'pilot start did not retain loopback binding'

expect_failure 'production frontend deploy rejects official test keys' "$TMP_DIR/deploy-production.log" \
  'Official Turnstile test keys are forbidden in production deployment' \
  env DEPLOYMENT_MODE=production PUBLIC_ORIGIN=https://pilot.example.org \
    TURNSTILE_SITE_KEY="$TEST_SITE" TURNSTILE_SECRET_KEY="$TEST_SECRET" \
    TURNSTILE_EXPECTED_ACTION=contact PROXY_URL=http://127.0.0.1:8083 \
    PRODUCTION_ENV="$TMP_DIR/not-present.env" bash "$DEPLOY_FRONTEND"

expect_failure 'pilot frontend deploy accepts test keys and reaches source validation' "$TMP_DIR/deploy-pilot.log" \
  'Frontend source not found' \
  env DEPLOYMENT_MODE=pilot PUBLIC_ORIGIN=https://pilot.example.org \
    TURNSTILE_SITE_KEY="$TEST_SITE" TURNSTILE_SECRET_KEY="$TEST_SECRET" \
    TURNSTILE_EXPECTED_ACTION=contact PROXY_URL=http://127.0.0.1:8083 \
    FRONTEND_SOURCE="$TMP_DIR/missing-frontend" PRODUCTION_ENV="$TMP_DIR/not-present.env" \
    bash "$DEPLOY_FRONTEND"

printf '\nDeployment mode infrastructure tests: %d passed.\n' "$pass_count"
