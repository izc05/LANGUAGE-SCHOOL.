#!/usr/bin/env bash
set -euo pipefail

PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"

if [[ ! -f "$PRODUCTION_ENV" ]]; then
  echo "Production environment file not found: $PRODUCTION_ENV" >&2
  echo 'Run prepare-production-env.sh and configure it before installing PocketBase.' >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$PRODUCTION_ENV"

PB_VERSION="${PB_VERSION:-0.39.9}"
PB_SHA256_AMD64="${PB_SHA256_AMD64:-4c5a1aced62ebf658bfbcfeaa944c4bfa88b173dd9d598d3cab55ea63587b36b}"
PB_SHA256_ARM64="${PB_SHA256_ARM64:-fd4138f29182288cbe6e9982e9f29b11df5f8e689c4f6a8f6cdf7aadd29d95a1}"
SERVICE_USER="${SERVICE_USER:-languageschool}"
SERVICE_GROUP="${SERVICE_GROUP:-languageschool}"
APP_ROOT="${APP_ROOT:-/opt/language-school}"
PB_DIR="$APP_ROOT/pocketbase"
DATA_ROOT="${DATA_ROOT:-/var/lib/language-school}"
PB_DATA="$DATA_ROOT/pb_data"
SERVICE_FILE="/etc/systemd/system/language-school-pocketbase.service"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
V3_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_SOURCE="$V3_DIR/pocketbase/pb_migrations"
HOOKS_SOURCE="$V3_DIR/pocketbase/pb_hooks"
SERVICE_SOURCE="$SCRIPT_DIR/language-school-pocketbase.service"
START_SOURCE="$SCRIPT_DIR/start-pocketbase.sh"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

HOST_ARCH="$(uname -m)"
case "$HOST_ARCH" in
  x86_64|amd64)
    PB_RELEASE_ARCH='amd64'
    PB_SHA256="$PB_SHA256_AMD64"
    ;;
  aarch64|arm64)
    PB_RELEASE_ARCH='arm64'
    PB_SHA256="$PB_SHA256_ARM64"
    ;;
  *)
    echo "Unsupported architecture: $HOST_ARCH. Expected x86_64/amd64 or aarch64/arm64." >&2
    exit 1
    ;;
esac

PB_ARCHIVE="pocketbase_${PB_VERSION}_linux_${PB_RELEASE_ARCH}.zip"

if [[ ! -d "$MIGRATIONS_SOURCE" ]]; then
  echo "Migrations directory not found: $MIGRATIONS_SOURCE" >&2
  exit 1
fi

if [[ ! -d "$HOOKS_SOURCE" ]]; then
  echo "Hooks directory not found: $HOOKS_SOURCE" >&2
  exit 1
fi

if [[ ! -f "$SERVICE_SOURCE" ]]; then
  echo "Systemd template not found: $SERVICE_SOURCE" >&2
  exit 1
fi

if [[ ! -f "$START_SOURCE" ]]; then
  echo "PocketBase start wrapper not found: $START_SOURCE" >&2
  exit 1
fi

for command in curl unzip sha256sum install systemctl; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

if ! getent group "$SERVICE_GROUP" >/dev/null; then
  groupadd --system "$SERVICE_GROUP"
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system \
    --gid "$SERVICE_GROUP" \
    --home-dir "$DATA_ROOT" \
    --shell /usr/sbin/nologin \
    "$SERVICE_USER"
fi

install -d -m 0755 -o root -g root "$APP_ROOT" "$PB_DIR"
install -d -m 0700 -o "$SERVICE_USER" -g "$SERVICE_GROUP" "$DATA_ROOT" "$PB_DATA"
install -d -m 0755 -o root -g root "$PB_DIR/pb_migrations" "$PB_DIR/pb_hooks"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

DOWNLOAD_URL="https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${PB_ARCHIVE}"
echo "Detected host architecture: $HOST_ARCH -> linux_${PB_RELEASE_ARCH}"
echo "Downloading PocketBase ${PB_VERSION} linux_${PB_RELEASE_ARCH}..."
curl --fail --location --retry 3 --output "$TMP_DIR/$PB_ARCHIVE" "$DOWNLOAD_URL"

echo "${PB_SHA256}  $TMP_DIR/$PB_ARCHIVE" | sha256sum --check --status || {
  echo 'PocketBase checksum verification failed.' >&2
  exit 1
}

echo 'Checksum verified.'
unzip -q "$TMP_DIR/$PB_ARCHIVE" -d "$TMP_DIR/pocketbase"
install -m 0755 -o root -g root "$TMP_DIR/pocketbase/pocketbase" "$PB_DIR/pocketbase"
install -m 0755 -o root -g root "$START_SOURCE" "$PB_DIR/start-pocketbase.sh"

rm -rf "$PB_DIR/pb_migrations"/* "$PB_DIR/pb_hooks"/*
cp -a "$MIGRATIONS_SOURCE"/. "$PB_DIR/pb_migrations/"
cp -a "$HOOKS_SOURCE"/. "$PB_DIR/pb_hooks/"
chown -R root:root "$PB_DIR/pb_migrations" "$PB_DIR/pb_hooks"
find "$PB_DIR/pb_migrations" "$PB_DIR/pb_hooks" -type d -exec chmod 0755 {} +
find "$PB_DIR/pb_migrations" "$PB_DIR/pb_hooks" -type f -exec chmod 0644 {} +

install -m 0644 -o root -g root "$SERVICE_SOURCE" "$SERVICE_FILE"
systemctl daemon-reload
systemctl enable language-school-pocketbase.service

echo
printf 'PocketBase %s installed at %s\n' "$PB_VERSION" "$PB_DIR"
printf 'Runtime data: %s\n' "$PB_DATA"
printf 'Server hooks: %s\n' "$PB_DIR/pb_hooks"
echo 'Service enabled but not started by this installer.'
echo 'Next: run migrate.sh, then bootstrap-admin.sh and health-check.sh.'
