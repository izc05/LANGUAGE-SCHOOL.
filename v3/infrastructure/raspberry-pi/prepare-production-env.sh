#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ENV="$SCRIPT_DIR/../.env.example"
TARGET_DIR="/etc/language-school"
TARGET_ENV="$TARGET_DIR/production.env"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

if [[ ! -f "$SOURCE_ENV" ]]; then
  echo "Environment example not found: $SOURCE_ENV" >&2
  exit 1
fi

install -d -m 0750 -o root -g root "$TARGET_DIR"

if [[ -f "$TARGET_ENV" ]]; then
  echo "$TARGET_ENV already exists; leaving it untouched."
else
  install -m 0640 -o root -g root "$SOURCE_ENV" "$TARGET_ENV"
  echo "Created $TARGET_ENV from the repository example."
fi

echo 'Edit PUBLIC_ORIGIN and BACKUP_MOUNT before production deployment.'
