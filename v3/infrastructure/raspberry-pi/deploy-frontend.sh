#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
V3_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
FRONTEND_SOURCE="${FRONTEND_SOURCE:-$V3_DIR/frontend}"
FRONTEND_TARGET="${FRONTEND_TARGET:-/opt/language-school/frontend}"
PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"

if [[ -f "$PRODUCTION_ENV" ]]; then
  # shellcheck disable=SC1090
  source "$PRODUCTION_ENV"
fi

PUBLIC_ORIGIN="${PUBLIC_ORIGIN:-}"
if [[ -z "$PUBLIC_ORIGIN" ]]; then
  echo 'PUBLIC_ORIGIN is required, for example https://english.example.com' >&2
  exit 1
fi

if [[ ! "$PUBLIC_ORIGIN" =~ ^https?://[^/]+$ ]]; then
  echo 'PUBLIC_ORIGIN must be an origin without a trailing path.' >&2
  exit 1
fi

for command in node npm rsync; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

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
npm run build

if [[ ! -f dist/index.html ]]; then
  echo 'Frontend build did not produce dist/index.html.' >&2
  exit 1
fi

"${SUDO[@]}" install -d -m 0755 -o root -g root "$FRONTEND_TARGET"
"${SUDO[@]}" rsync -a --delete dist/ "$FRONTEND_TARGET/"
"${SUDO[@]}" chown -R root:root "$FRONTEND_TARGET"
"${SUDO[@]}" find "$FRONTEND_TARGET" -type d -exec chmod 0755 {} +
"${SUDO[@]}" find "$FRONTEND_TARGET" -type f -exec chmod 0644 {} +

printf 'Frontend deployed to %s\n' "$FRONTEND_TARGET"
printf 'PocketBase public origin compiled as %s\n' "$PUBLIC_ORIGIN"
