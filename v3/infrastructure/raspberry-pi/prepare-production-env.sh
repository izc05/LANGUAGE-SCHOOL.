#!/usr/bin/env bash
set -euo pipefail

TARGET="${PRODUCTION_ENV:-/etc/language-school/production.env}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/../.env.example"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "Environment template not found: $SOURCE" >&2
  exit 1
fi

install -d -m 0755 -o root -g root "$(dirname "$TARGET")"

if [[ -e "$TARGET" ]]; then
  echo "Production environment already exists: $TARGET" >&2
  echo 'Review it manually instead of overwriting it.' >&2
  exit 1
fi

install -m 0640 -o root -g root "$SOURCE" "$TARGET"

cat <<EOF
Production environment created at:
  $TARGET

Before any production deployment, edit it as root and:
1. replace PUBLIC_ORIGIN with the final public HTTPS origin;
2. verify PB_URL / PROXY_URL remain loopback-only;
3. configure a real Cloudflare Turnstile widget for the final hostname;
4. replace TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY placeholders;
5. keep TURNSTILE_EXPECTED_ACTION=contact and include the PUBLIC_ORIGIN hostname in TURNSTILE_ALLOWED_HOSTNAMES;
6. set BACKUP_MOUNT to the real external backup mountpoint;
7. if Zoom will be enabled, add the private server variables listed in:
   v3/infrastructure/PRIVATE-VARIABLES.md

Never place real secrets in Git, VITE_* variables or public CMS records.
TURNSTILE_SITE_KEY is public; TURNSTILE_SECRET_KEY is server-only.
The file must remain root-owned with mode 0640.
EOF
