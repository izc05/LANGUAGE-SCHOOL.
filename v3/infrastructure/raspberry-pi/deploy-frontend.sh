#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
V3_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
FRONTEND_SOURCE="${FRONTEND_SOURCE:-$V3_DIR/frontend}"
FRONTEND_TARGET="${FRONTEND_TARGET:-/opt/language-school/frontend}"
FRONTEND_STAGING="${FRONTEND_STAGING:-${FRONTEND_TARGET}.staging}"
FRONTEND_PREVIOUS="${FRONTEND_PREVIOUS:-${FRONTEND_TARGET}.previous}"
PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"

if [[ -r "$PRODUCTION_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$PRODUCTION_ENV"
elif command -v sudo >/dev/null && sudo test -r "$PRODUCTION_ENV"; then
  # production.env is intentionally root-owned; read it without relaxing its permissions.
  # shellcheck disable=SC1090
  source <(sudo cat -- "$PRODUCTION_ENV")
fi

PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-}"
DEPLOYMENT_MODE="${DEPLOYMENT_MODE:-production}"
case "$DEPLOYMENT_MODE" in
  pilot|production) ;;
  *)
    echo 'DEPLOYMENT_MODE must be exactly pilot or production.' >&2
    exit 1
    ;;
esac
printf 'Deployment mode: %s\n' "${DEPLOYMENT_MODE^^}"

if [[ -z "$PUBLIC_ORIGIN" ]]; then
  echo 'PUBLIC_ORIGIN is required and must be the final public HTTPS origin.' >&2
  exit 1
fi

if [[ ! "$PUBLIC_ORIGIN" =~ ^https://[^/]+$ ]]; then
  echo 'PUBLIC_ORIGIN must use HTTPS and contain only the origin, without a path or trailing slash.' >&2
  exit 1
fi

PUBLIC_HOST="${PUBLIC_ORIGIN#https://}"
PUBLIC_HOST="${PUBLIC_HOST%%:*}"
PUBLIC_HOST="${PUBLIC_HOST,,}"

case "$PUBLIC_HOST" in
  localhost|127.*|0.0.0.0|example.com|*.example.com|*.example|*.invalid|*.test|*.local)
    echo "PUBLIC_ORIGIN uses a local or placeholder host and cannot be deployed: $PUBLIC_ORIGIN" >&2
    exit 1
    ;;
esac

TURNSTILE_SITE_KEY="${TURNSTILE_SITE_KEY:-}"
TURNSTILE_SECRET_KEY="${TURNSTILE_SECRET_KEY:-}"
TURNSTILE_EXPECTED_ACTION="${TURNSTILE_EXPECTED_ACTION:-}"
TURNSTILE_ALLOWED_HOSTNAMES="${TURNSTILE_ALLOWED_HOSTNAMES:-}"
TURNSTILE_TEST_SITE_KEY='1x00000000000000000000AA'
TURNSTILE_TEST_SECRET_KEY='1x0000000000000000000000000000000AA'

if [[ -z "$TURNSTILE_SITE_KEY" || "$TURNSTILE_SITE_KEY" == REPLACE_* ]]; then
  echo 'TURNSTILE_SITE_KEY is required for deployment.' >&2
  exit 1
fi
if [[ -z "$TURNSTILE_SECRET_KEY" || "$TURNSTILE_SECRET_KEY" == REPLACE_* ]]; then
  echo 'TURNSTILE_SECRET_KEY is required for deployment.' >&2
  exit 1
fi
if [[ "$TURNSTILE_EXPECTED_ACTION" != 'contact' ]]; then
  echo 'TURNSTILE_EXPECTED_ACTION must be exactly contact.' >&2
  exit 1
fi

TURNSTILE_TEST_PAIR=false
if [[ "$TURNSTILE_SITE_KEY" == "$TURNSTILE_TEST_SITE_KEY" && "$TURNSTILE_SECRET_KEY" == "$TURNSTILE_TEST_SECRET_KEY" ]]; then
  TURNSTILE_TEST_PAIR=true
elif [[ "$TURNSTILE_SITE_KEY" == "$TURNSTILE_TEST_SITE_KEY" || "$TURNSTILE_SECRET_KEY" == "$TURNSTILE_TEST_SECRET_KEY" ]]; then
  echo 'The official Turnstile test site key and secret must be configured together.' >&2
  exit 1
fi

if [[ "$DEPLOYMENT_MODE" == 'production' && "$TURNSTILE_TEST_PAIR" == true ]]; then
  echo 'Official Turnstile test keys are forbidden in production deployment.' >&2
  exit 1
fi

if [[ "$TURNSTILE_TEST_PAIR" != true && -z "$TURNSTILE_ALLOWED_HOSTNAMES" ]]; then
  echo 'TURNSTILE_ALLOWED_HOSTNAMES must contain the public hostname when real Turnstile keys are used.' >&2
  exit 1
fi

HOSTNAME_ALLOWED=false
IFS=',' read -ra TURNSTILE_HOSTS <<< "$TURNSTILE_ALLOWED_HOSTNAMES"
if [[ "$TURNSTILE_TEST_PAIR" != true ]]; then
  for host in "${TURNSTILE_HOSTS[@]}"; do
    host="${host//[[:space:]]/}"
    host="${host,,}"
    case "$host" in
      localhost|127.*|0.0.0.0|*.local|*.test|*.invalid)
        echo "TURNSTILE_ALLOWED_HOSTNAMES contains a local/test hostname: $host" >&2
        exit 1
        ;;
    esac
    if [[ "$host" == "$PUBLIC_HOST" ]]; then HOSTNAME_ALLOWED=true; fi
  done
  if [[ "$HOSTNAME_ALLOWED" != true ]]; then
    echo 'TURNSTILE_ALLOWED_HOSTNAMES must include the hostname from PUBLIC_ORIGIN.' >&2
    exit 1
  fi
fi

if [[ "$TURNSTILE_TEST_PAIR" == true ]]; then
  echo 'PILOT uses the official Turnstile test key pair; hostname validation is non-definitive.'
fi

PROXY_URL="${PROXY_URL:-}"
if [[ ! "$PROXY_URL" =~ ^http://127\.0\.0\.1:[0-9]+$ ]]; then
  echo 'PROXY_URL must use an explicit 127.0.0.1 loopback HTTP endpoint.' >&2
  exit 1
fi

for command in node npm rsync curl sha256sum; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

NODE_VERSION="$(node --version)"
NODE_VERSION="${NODE_VERSION#v}"
IFS='.' read -r NODE_MAJOR NODE_MINOR _ <<< "$NODE_VERSION"
if ! {
  (( NODE_MAJOR == 20 && NODE_MINOR >= 19 )) ||
  (( NODE_MAJOR == 22 && NODE_MINOR >= 12 )) ||
  (( NODE_MAJOR > 22 ));
}; then
  echo "Node.js $NODE_VERSION is not supported by Vite 8." >&2
  echo 'Install Node.js 20.19+ or 22.12+ before deploying the frontend.' >&2
  exit 1
fi

echo "Node.js $NODE_VERSION satisfies the Vite 8 runtime requirement."

if [[ ! -f "$FRONTEND_SOURCE/package.json" ]]; then
  echo "Frontend source not found: $FRONTEND_SOURCE" >&2
  exit 1
fi

if [[ "${EUID}" -eq 0 ]]; then
  SUDO=()
else
  command -v sudo >/dev/null || {
    echo 'sudo is required to deploy into /opt.' >&2
    exit 1
  }
  SUDO=(sudo)
fi

cd "$FRONTEND_SOURCE"

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

VITE_APP_MODE=connected \
VITE_POCKETBASE_URL="$PUBLIC_ORIGIN" \
VITE_TURNSTILE_SITE_KEY="$TURNSTILE_SITE_KEY" \
npm run build

if [[ ! -f dist/index.html ]]; then
  echo 'Frontend build did not produce dist/index.html.' >&2
  exit 1
fi

# Prepare the new build away from the live document root. Promotion below uses
# directory renames on the same filesystem, avoiding a partially copied live UI.
"${SUDO[@]}" rm -rf -- "$FRONTEND_STAGING"
"${SUDO[@]}" install -d -m 0755 -o root -g root "$FRONTEND_STAGING"
"${SUDO[@]}" rsync -a --delete dist/ "$FRONTEND_STAGING/"
"${SUDO[@]}" chown -R root:root "$FRONTEND_STAGING"
"${SUDO[@]}" find "$FRONTEND_STAGING" -type d -exec chmod 0755 {} +
"${SUDO[@]}" find "$FRONTEND_STAGING" -type f -exec chmod 0644 {} +
"${SUDO[@]}" test -f "$FRONTEND_STAGING/index.html"
EXPECTED_INDEX_SHA="$(sha256sum "$FRONTEND_STAGING/index.html" | awk '{print $1}')"

had_previous=0
live_displaced=0
promoted=0
rollback_promotion() {
  set +e
  if [[ "$promoted" -eq 1 ]]; then
    "${SUDO[@]}" rm -rf -- "$FRONTEND_TARGET"
  fi
  if [[ "$live_displaced" -eq 1 && "$had_previous" -eq 1 && -d "$FRONTEND_PREVIOUS" ]]; then
    "${SUDO[@]}" mv -- "$FRONTEND_PREVIOUS" "$FRONTEND_TARGET"
  fi
  "${SUDO[@]}" rm -rf -- "$FRONTEND_STAGING"
}
trap rollback_promotion ERR

"${SUDO[@]}" install -d -m 0755 -o root -g root "$(dirname "$FRONTEND_TARGET")"
"${SUDO[@]}" rm -rf -- "$FRONTEND_PREVIOUS"
if [[ -d "$FRONTEND_TARGET" ]]; then
  "${SUDO[@]}" mv -- "$FRONTEND_TARGET" "$FRONTEND_PREVIOUS"
  had_previous=1
  live_displaced=1
fi
"${SUDO[@]}" mv -- "$FRONTEND_STAGING" "$FRONTEND_TARGET"
promoted=1

# Verify the actual Nginx document root after promotion. Any failure here
# automatically restores the previous frontend before this script exits.
for attempt in {1..15}; do
  PROXY_BODY="$(mktemp)"
  if curl -fsS --max-time 5 "$PROXY_URL/" -o "$PROXY_BODY"; then
    ACTUAL_INDEX_SHA="$(sha256sum "$PROXY_BODY" | awk '{print $1}')"
    rm -f "$PROXY_BODY"
    if [[ "$ACTUAL_INDEX_SHA" == "$EXPECTED_INDEX_SHA" ]]; then
      trap - ERR
      printf 'Frontend deployed atomically to %s\n' "$FRONTEND_TARGET"
      if [[ "$had_previous" -eq 1 ]]; then
        printf 'Previous frontend preserved at %s\n' "$FRONTEND_PREVIOUS"
      else
        printf 'No previous frontend existed; this was the first promotion.\n'
      fi
      printf 'PocketBase public origin compiled as %s\n' "$PUBLIC_ORIGIN"
      printf 'Turnstile public sitekey compiled without exposing its secret.\n'
      exit 0
    fi
  else
    rm -f "$PROXY_BODY"
  fi
  sleep 1
done

echo 'Promoted frontend did not become reachable through the local proxy; restoring the previous frontend.' >&2
false
