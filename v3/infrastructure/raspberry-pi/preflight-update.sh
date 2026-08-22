#!/usr/bin/env bash
set -euo pipefail

PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"
REPO_DIR="${REPO_DIR:-$(pwd)}"
EXPECTED_SHA="${EXPECTED_SHA:-}"
EXPECTED_BRANCH="${EXPECTED_BRANCH:-design/home-premium-v2}"
EXPECTED_PUBLIC_ORIGIN="${EXPECTED_PUBLIC_ORIGIN:-https://language-school.isivoltpro.com}"
CHECK_PUBLIC="${CHECK_PUBLIC:-1}"
HOST_CHECKS="${HOST_CHECKS:-1}"
SERVICE="${SERVICE:-language-school-pocketbase.service}"
PB_RUNTIME_DIR="${PB_RUNTIME_DIR:-/opt/language-school/pocketbase}"
FRONTEND_TARGET="${FRONTEND_TARGET:-/opt/language-school/frontend}"

failures=0
warnings=0

ok() { printf 'OK   %s\n' "$1"; }
warn() { printf 'WARN %s\n' "$1" >&2; warnings=$((warnings + 1)); }
fail() { printf 'FAIL %s\n' "$1" >&2; failures=$((failures + 1)); }
git_repo() { git -c safe.directory="$REPO_DIR" -C "$REPO_DIR" "$@"; }

require_command() {
  if command -v "$1" >/dev/null 2>&1; then ok "command available: $1"; else fail "missing command: $1"; fi
}

read_production_env() {
  if [[ -r "$PRODUCTION_ENV" ]]; then
    # shellcheck disable=SC1090
    source "$PRODUCTION_ENV"
  elif command -v sudo >/dev/null 2>&1 && sudo -n test -r "$PRODUCTION_ENV" 2>/dev/null; then
    # shellcheck disable=SC1090
    source <(sudo -n cat -- "$PRODUCTION_ENV")
  else
    fail "production environment is missing or unreadable: $PRODUCTION_ENV"
    return 1
  fi
  ok 'production environment is readable'
}

secret_present() {
  local name="$1" value="${!1:-}"
  if [[ -z "$value" || "$value" == REPLACE_* ]]; then
    fail "$name is missing or still uses a placeholder"
  else
    ok "$name is configured"
  fi
}

loopback_url() {
  local label="$1" value="$2"
  if [[ "$value" =~ ^http://127\.0\.0\.1:[0-9]+$ ]]; then
    ok "$label is loopback-only"
  else
    fail "$label must use http://127.0.0.1:<port>"
  fi
}

url_port() {
  local value="$1"
  printf '%s' "${value##*:}"
}

check_listener_loopback() {
  local label="$1" value="$2" port listeners addresses
  port="$(url_port "$value")"
  listeners="$(ss -H -ltn 2>/dev/null | awk -v p=":$port" '$4 ~ p"$" {print $4}' || true)"
  if [[ -z "$listeners" ]]; then
    fail "$label has no TCP listener on port $port"
    return
  fi
  addresses="$(printf '%s\n' "$listeners" | grep -Ev "^(127\\.0\\.0\\.1|\\[::1\\]):$port$" || true)"
  if [[ -n "$addresses" ]]; then
    fail "$label is exposed beyond loopback on port $port"
  else
    ok "$label listener is restricted to loopback"
  fi
}

http_ok() {
  local label="$1" url="$2"
  if curl -fsS --max-time 8 "$url" >/dev/null; then ok "$label"; else fail "$label"; fi
}

http_status() {
  local label="$1" url="$2" expected="$3" status
  status="$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' "$url" || true)"
  if [[ "$status" == "$expected" ]]; then ok "$label"; else fail "$label (expected HTTP $expected, got ${status:-none})"; fi
}

printf 'Language School 9.8 · preflight de actualización (solo lectura)\n'
printf 'Repository: %s\n' "$REPO_DIR"

read_production_env || true

DEPLOYMENT_MODE="${DEPLOYMENT_MODE:-production}"
case "$DEPLOYMENT_MODE" in
  pilot) PILOT_MODE=1 ;;
  production) PILOT_MODE=0 ;;
  *)
    PILOT_MODE=0
    fail 'DEPLOYMENT_MODE must be exactly pilot or production'
    ;;
esac

printf 'Deployment mode: %s\n' "${DEPLOYMENT_MODE^^}"

for command in git curl node npm rsync sha256sum jq; do require_command "$command"; done
if [[ "$HOST_CHECKS" == '1' ]]; then
  for command in systemctl mountpoint ss stat; do require_command "$command"; done
fi

NODE_VERSION="$(node --version 2>/dev/null || true)"
NODE_VERSION="${NODE_VERSION#v}"
IFS='.' read -r NODE_MAJOR NODE_MINOR _ <<< "$NODE_VERSION"
if [[ "$NODE_MAJOR" =~ ^[0-9]+$ && "$NODE_MINOR" =~ ^[0-9]+$ ]] && {
  (( NODE_MAJOR == 20 && NODE_MINOR >= 19 )) ||
  (( NODE_MAJOR == 22 && NODE_MINOR >= 12 )) ||
  (( NODE_MAJOR > 22 ));
}; then
  ok "Node.js $NODE_VERSION satisfies Vite 8"
else
  fail "Node.js ${NODE_VERSION:-unknown} is not compatible with Vite 8; require 20.19+ or 22.12+"
fi

if [[ -z "$EXPECTED_SHA" ]]; then
  fail 'EXPECTED_SHA is required; pass the exact 7/7-green candidate SHA'
elif [[ ! "$EXPECTED_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
  fail 'EXPECTED_SHA must be a full 40-character Git SHA'
fi

if git_repo rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  current_sha="$(git_repo rev-parse HEAD)"
  current_branch="$(git_repo branch --show-current)"
  if [[ "$current_sha" == "$EXPECTED_SHA" ]]; then ok "repository HEAD matches $EXPECTED_SHA"; else fail "repository HEAD $current_sha does not match expected $EXPECTED_SHA"; fi
  if [[ "$current_branch" == "$EXPECTED_BRANCH" ]]; then ok "repository branch is $EXPECTED_BRANCH"; else fail "repository branch is $current_branch, expected $EXPECTED_BRANCH"; fi
  if [[ -z "$(git_repo status --porcelain --untracked-files=normal)" ]]; then ok 'repository working tree is clean'; else fail 'repository working tree has uncommitted or untracked changes'; fi
else
  fail "REPO_DIR is not a Git worktree: $REPO_DIR"
fi

if [[ ! -d "$REPO_DIR/v3/pocketbase/pb_migrations" || ! -d "$REPO_DIR/v3/pocketbase/pb_hooks" || ! -f "$REPO_DIR/v3/frontend/package.json" ]]; then
  fail 'candidate checkout is missing frontend, migrations or PocketBase hooks'
else
  ok 'candidate contains frontend + migrations + hooks'
fi

PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-}"
PB_URL="${PB_URL:-}"
PROXY_URL="${PROXY_URL:-}"
BACKUP_MOUNT="${BACKUP_MOUNT:-}"
SMTP_ENABLED="${SMTP_ENABLED:-}"
TURNSTILE_SITE_KEY="${TURNSTILE_SITE_KEY:-}"
TURNSTILE_SECRET_KEY="${TURNSTILE_SECRET_KEY:-}"
TURNSTILE_EXPECTED_ACTION="${TURNSTILE_EXPECTED_ACTION:-}"
TURNSTILE_ALLOWED_HOSTNAMES="${TURNSTILE_ALLOWED_HOSTNAMES:-}"
ZOOM_ACCOUNT_ID="${ZOOM_ACCOUNT_ID:-}"
ZOOM_CLIENT_ID="${ZOOM_CLIENT_ID:-}"
ZOOM_CLIENT_SECRET="${ZOOM_CLIENT_SECRET:-}"

if [[ "$PUBLIC_ORIGIN" =~ ^https://[^/]+$ ]]; then ok 'PUBLIC_ORIGIN is an HTTPS origin without path'; else fail 'PUBLIC_ORIGIN must be a final HTTPS origin without path/trailing slash'; fi
if [[ -n "$EXPECTED_PUBLIC_ORIGIN" && "$PUBLIC_ORIGIN" != "$EXPECTED_PUBLIC_ORIGIN" ]]; then
  fail "PUBLIC_ORIGIN does not match expected pilot origin $EXPECTED_PUBLIC_ORIGIN"
else
  ok 'PUBLIC_ORIGIN matches the expected pilot origin'
fi

loopback_url 'PB_URL' "$PB_URL"
loopback_url 'PROXY_URL' "$PROXY_URL"
if [[ "$PB_URL" == "$PROXY_URL" ]]; then fail 'PB_URL and PROXY_URL must use different loopback ports'; else ok 'PocketBase and proxy use different ports'; fi

TURNSTILE_TEST_SITE_KEY='1x00000000000000000000AA'
TURNSTILE_TEST_SECRET_KEY='1x0000000000000000000000000000000AA'

public_host="${PUBLIC_ORIGIN#https://}"
public_host="${public_host%%:*}"
allowed=false
IFS=',' read -ra turnstile_hosts <<< "$TURNSTILE_ALLOWED_HOSTNAMES"
for host in "${turnstile_hosts[@]}"; do
  host="${host//[[:space:]]/}"
  [[ "${host,,}" == "${public_host,,}" ]] && allowed=true
done

turnstile_test_pair=false
if [[ "$TURNSTILE_SITE_KEY" == "$TURNSTILE_TEST_SITE_KEY" && "$TURNSTILE_SECRET_KEY" == "$TURNSTILE_TEST_SECRET_KEY" ]]; then
  turnstile_test_pair=true
elif [[ "$TURNSTILE_SITE_KEY" == "$TURNSTILE_TEST_SITE_KEY" || "$TURNSTILE_SECRET_KEY" == "$TURNSTILE_TEST_SECRET_KEY" ]]; then
  fail 'Turnstile official test site key and secret must be configured together'
fi

if [[ "$PILOT_MODE" == '1' ]]; then
  case "${SMTP_ENABLED,,}" in
    false) warn 'SMTP is disabled in PILOT; ADMIN email MFA, invitations and password recovery cannot be tested yet' ;;
    true)
      ok 'SMTP is enabled in PILOT'
      secret_present SMTP_HOST
      secret_present SMTP_SENDER_ADDRESS
      if [[ "$SMTP_USERNAME" == REPLACE_* || "$SMTP_PASSWORD" == REPLACE_* ]]; then
        fail 'SMTP credential placeholders are forbidden when SMTP is enabled'
      else
        ok 'SMTP credentials do not use placeholders (authless test SMTP is allowed in PILOT)'
      fi
      ;;
    *) fail 'SMTP_ENABLED must be true or false' ;;
  esac

  secret_present TURNSTILE_SITE_KEY
  secret_present TURNSTILE_SECRET_KEY
  if [[ "$turnstile_test_pair" == true ]]; then
    ok 'PILOT uses the official Turnstile test key pair'
    warn 'Turnstile hostname validation is not definitive while PILOT uses official test keys'
  elif [[ "$allowed" == true ]]; then
    ok 'Turnstile hostname allowlist contains PUBLIC_ORIGIN host'
  else
    fail 'Turnstile hostname allowlist must contain PUBLIC_ORIGIN host when PILOT uses real keys'
  fi
  if [[ "$TURNSTILE_EXPECTED_ACTION" == 'contact' ]]; then ok 'Turnstile action is contact'; else fail 'TURNSTILE_EXPECTED_ACTION must be contact'; fi

  if [[ -n "$ZOOM_ACCOUNT_ID" && "$ZOOM_ACCOUNT_ID" != REPLACE_* && -n "$ZOOM_CLIENT_ID" && "$ZOOM_CLIENT_ID" != REPLACE_* && -n "$ZOOM_CLIENT_SECRET" && "$ZOOM_CLIENT_SECRET" != REPLACE_* ]]; then
    ok 'Zoom server credentials are configured'
  else
    warn 'Zoom credentials are not configured in PILOT; Zoom flows cannot be tested yet'
  fi
else
  if [[ "$SMTP_ENABLED" == 'true' ]]; then ok 'SMTP is enabled'; else fail 'SMTP_ENABLED must be true because ADMIN MFA depends on email'; fi
  secret_present SMTP_HOST
  secret_present SMTP_USERNAME
  secret_present SMTP_PASSWORD
  secret_present SMTP_SENDER_ADDRESS
  secret_present TURNSTILE_SITE_KEY
  secret_present TURNSTILE_SECRET_KEY
  if [[ "$TURNSTILE_SITE_KEY" == "$TURNSTILE_TEST_SITE_KEY" ]]; then fail 'Turnstile production site key is the official test key'; else ok 'Turnstile site key is not the official test key'; fi
  if [[ "$TURNSTILE_SECRET_KEY" == "$TURNSTILE_TEST_SECRET_KEY" ]]; then fail 'Turnstile production secret is the official test secret'; else ok 'Turnstile secret is not the official test secret'; fi
  if [[ "$TURNSTILE_EXPECTED_ACTION" == 'contact' ]]; then ok 'Turnstile action is contact'; else fail 'TURNSTILE_EXPECTED_ACTION must be contact'; fi
  if [[ "$allowed" == true ]]; then ok 'Turnstile hostname allowlist contains PUBLIC_ORIGIN host'; else fail 'Turnstile hostname allowlist does not contain PUBLIC_ORIGIN host'; fi
fi

if [[ "$HOST_CHECKS" == '1' ]]; then
  ENV_OWNER_MODE="$(stat -c '%U:%G %a' "$PRODUCTION_ENV" 2>/dev/null || true)"
  case "$ENV_OWNER_MODE" in
    'root:root 600'|'root:root 640') ok "production.env ownership/mode is $ENV_OWNER_MODE" ;;
    *) fail "production.env must be root:root with mode 0600 or 0640 (got ${ENV_OWNER_MODE:-unknown})" ;;
  esac

  if [[ -n "$BACKUP_MOUNT" && -d "$BACKUP_MOUNT" ]] && mountpoint -q "$BACKUP_MOUNT"; then ok 'backup destination is a real mountpoint'; else fail 'BACKUP_MOUNT is not an active mountpoint'; fi

  if systemctl is-active --quiet "$SERVICE"; then ok 'PocketBase service is active'; else fail 'PocketBase service is not active'; fi
  if systemctl is-active --quiet nginx; then ok 'Nginx service is active'; else fail 'Nginx service is not active'; fi

  if [[ ! -x "$PB_RUNTIME_DIR/pocketbase" || ! -d "$PB_RUNTIME_DIR/pb_migrations" ]]; then
    fail 'installed PocketBase runtime is missing the binary or migrations'
  elif [[ ! -d "$PB_RUNTIME_DIR/pb_hooks" ]]; then
    warn 'installed PocketBase runtime predates pb_hooks; after a verified physical backup, repair it only with install-pocketbase.sh from the approved candidate'
  else
    ok 'installed PocketBase runtime contains binary + migrations + hooks'
  fi
  if [[ -f "$FRONTEND_TARGET/index.html" ]]; then ok 'installed frontend exists'; else fail 'installed frontend index.html is missing'; fi

  check_listener_loopback 'PocketBase' "$PB_URL"
  check_listener_loopback 'Nginx proxy' "$PROXY_URL"
  http_ok 'PocketBase direct /api/health responds' "$PB_URL/api/health"
  http_ok 'Proxy /api/health responds' "$PROXY_URL/api/health"
  http_ok 'Frontend responds through proxy' "$PROXY_URL/"
  http_status 'PocketBase admin UI is blocked locally' "$PROXY_URL/_/" '404'

  if systemctl is-enabled --quiet language-school-backup.timer 2>/dev/null; then ok 'backup timer is enabled'; else warn 'backup timer is not enabled'; fi
  if systemctl is-enabled --quiet language-school-health.timer 2>/dev/null; then ok 'health timer is enabled'; else warn 'health timer is not enabled'; fi

  if [[ "$CHECK_PUBLIC" == '1' ]]; then
    http_ok 'public HTTPS root responds' "$PUBLIC_ORIGIN/"
    http_ok 'public HTTPS /api/health responds' "$PUBLIC_ORIGIN/api/health"
    http_status 'PocketBase admin UI is blocked publicly' "$PUBLIC_ORIGIN/_/" '404'
  else
    warn 'public HTTPS checks skipped because CHECK_PUBLIC != 1'
  fi
else
  warn 'host/runtime checks skipped because HOST_CHECKS != 1'
fi

printf '\nPreflight summary: %d failure(s), %d warning(s).\n' "$failures" "$warnings"
if [[ "$failures" -ne 0 ]]; then
  echo '9.8 preflight: BLOCKED. Do not run backup/migrations/deploy yet.' >&2
  exit 1
fi

echo '9.8 preflight: READY FOR PHYSICAL BACKUP GATE. No changes were made.'
