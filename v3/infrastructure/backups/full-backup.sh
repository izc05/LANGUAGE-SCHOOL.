#!/usr/bin/env bash
set -euo pipefail

PRODUCTION_ENV="${PRODUCTION_ENV:-/etc/language-school/production.env}"
DAILY_BACKUP_SCRIPT="${DAILY_BACKUP_SCRIPT:-/usr/local/sbin/language-school-backup}"
PROJECT_DIR="${PROJECT_DIR:-/home/isi/projects/language-school}"
FULL_BACKUP_KEY="${FULL_BACKUP_KEY:-/etc/language-school/full-backup.key}"
FULL_BACKUP_RETENTION_COUNT="${FULL_BACKUP_RETENTION_COUNT:-8}"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Run this script as root (sudo).' >&2
  exit 1
fi

for command in mountpoint tar gpg sha256sum git find sort mktemp install stat; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

[[ -f "$PRODUCTION_ENV" ]] || {
  echo "Production environment file is missing: $PRODUCTION_ENV" >&2
  exit 1
}

# shellcheck disable=SC1090
source "$PRODUCTION_ENV"
BACKUP_MOUNT="${BACKUP_MOUNT:-/mnt/language-school-backup}"
BACKUP_DIR="$BACKUP_MOUNT/language-school"
FULL_BACKUP_DIR="$BACKUP_DIR/full"

if ! [[ "$FULL_BACKUP_RETENTION_COUNT" =~ ^[0-9]+$ ]] || (( 10#$FULL_BACKUP_RETENTION_COUNT < 2 || 10#$FULL_BACKUP_RETENTION_COUNT > 52 )); then
  echo 'FULL_BACKUP_RETENTION_COUNT must be an integer between 2 and 52.' >&2
  exit 1
fi

mountpoint -q "$BACKUP_MOUNT" || {
  echo "Full backup aborted: $BACKUP_MOUNT is not an active mountpoint." >&2
  exit 1
}

[[ -x "$DAILY_BACKUP_SCRIPT" ]] || {
  echo "Daily backup script is missing or not executable: $DAILY_BACKUP_SCRIPT" >&2
  exit 1
}

[[ -d "$PROJECT_DIR/.git" ]] || {
  echo "Language School Git repository not found: $PROJECT_DIR" >&2
  exit 1
}

[[ -f "$FULL_BACKUP_KEY" ]] || {
  echo "Full backup encryption key is missing: $FULL_BACKUP_KEY" >&2
  exit 1
}

key_metadata="$(stat -c '%U:%G %a' "$FULL_BACKUP_KEY")"
if [[ "$key_metadata" != 'root:root 600' ]]; then
  echo "Full backup encryption key must be root:root 600 (got $key_metadata)." >&2
  exit 1
fi

for required_path in \
  /opt/language-school/frontend/index.html \
  /opt/language-school/pocketbase/pocketbase \
  /opt/language-school/pocketbase/pb_migrations \
  /opt/language-school/pocketbase/pb_hooks \
  /etc/nginx/sites-available/language-school.conf \
  /etc/systemd/system/language-school-pocketbase.service; do
  [[ -e "$required_path" ]] || {
    echo "Required recovery component is missing: $required_path" >&2
    exit 1
  }
done

install -d -m 0700 "$FULL_BACKUP_DIR"
STAGING_DIR="$(mktemp -d /var/tmp/language-school-full-backup.XXXXXX)"
chmod 0700 "$STAGING_DIR"
TIMESTAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
ARCHIVE="$FULL_BACKUP_DIR/language-school-full-$TIMESTAMP.tar.gz.gpg"
PARTIAL="$ARCHIVE.partial"
CHECKSUM="$ARCHIVE.sha256"
LISTING="$STAGING_DIR/archive-list.txt"
backup_complete=0

cleanup() {
  rm -rf -- "$STAGING_DIR"
  rm -f -- "$PARTIAL"
  if [[ "$backup_complete" -ne 1 ]]; then
    rm -f -- "$ARCHIVE" "$CHECKSUM"
  fi
}
trap cleanup EXIT

# Create a fresh, service-consistent PocketBase backup first. The full archive
# embeds that verified snapshot instead of reading live pb_data directly.
"$DAILY_BACKUP_SCRIPT"

latest_data_archive="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'language-school-*.tar.gz' -printf '%T@ %p\n' | sort -nr | sed -n '1s/^[^ ]* //p')"
[[ -n "$latest_data_archive" && -f "$latest_data_archive.sha256" ]] || {
  echo 'A verified PocketBase backup could not be selected.' >&2
  exit 1
}
(
  cd "$BACKUP_DIR"
  sha256sum -c "$(basename "$latest_data_archive").sha256" >/dev/null
)

install -m 0600 "$latest_data_archive" "$STAGING_DIR/pocketbase-data.tar.gz"
(
  cd "$STAGING_DIR"
  sha256sum pocketbase-data.tar.gz > pocketbase-data.tar.gz.sha256
)
chmod 0600 "$STAGING_DIR/pocketbase-data.tar.gz.sha256"
git -c safe.directory="$PROJECT_DIR" -C "$PROJECT_DIR" bundle create "$STAGING_DIR/language-school.git.bundle" --all

current_sha="$(git -c safe.directory="$PROJECT_DIR" -C "$PROJECT_DIR" rev-parse HEAD)"
current_branch="$(git -c safe.directory="$PROJECT_DIR" -C "$PROJECT_DIR" branch --show-current)"
working_tree_state='clean'
if [[ -n "$(git -c safe.directory="$PROJECT_DIR" -C "$PROJECT_DIR" status --porcelain --untracked-files=normal)" ]]; then
  working_tree_state='dirty (source tree snapshot included)'
fi

printf '%s\n' \
  'Language School full recovery backup' \
  "Created (UTC): $TIMESTAMP" \
  "Host: $(hostname)" \
  "Git branch: $current_branch" \
  "Git commit: $current_sha" \
  "Working tree: $working_tree_state" \
  "Embedded PocketBase backup: $(basename "$latest_data_archive")" \
  'Encryption: GnuPG symmetric AES256' \
  'Contents: deployed frontend, PocketBase runtime/hooks/migrations, source tree, Git bundle, verified data backup, Nginx/systemd/Cloudflare host configuration.' \
  > "$STAGING_DIR/RECOVERY-MANIFEST.txt"

printf '%s\n' \
  '1. Copy the encrypted archive and its .sha256 file to a recovery machine.' \
  '2. Verify the encrypted archive with sha256sum -c.' \
  '3. Decrypt with GnuPG using the separately stored full-backup.key.' \
  '4. Extract only into an empty recovery directory for inspection.' \
  '5. Follow the repository restore runbook before replacing any production path.' \
  'Never extract directly over a running server without a reviewed recovery plan.' \
  > "$STAGING_DIR/RESTORE-INSTRUCTIONS.txt"

declare -a system_paths=(
  opt/language-school/frontend
  opt/language-school/pocketbase
  etc/language-school/production.env
  etc/nginx/nginx.conf
  etc/nginx/sites-available/language-school.conf
  etc/nginx/sites-enabled/language-school.conf
  etc/fstab
  home/isi/projects/language-school
)

for optional_path in etc/cloudflared usr/local/lib/language-school usr/local/sbin/language-school-backup; do
  [[ -e "/$optional_path" ]] && system_paths+=("$optional_path")
done

while IFS= read -r unit; do
  system_paths+=("${unit#/}")
done < <(find /etc/systemd/system -maxdepth 1 -type f \( -name 'language-school*' -o -name 'cloudflared*' \) -print | sort)

tar \
  --exclude='home/isi/projects/language-school/.git' \
  --exclude='home/isi/projects/language-school/**/node_modules' \
  --exclude='home/isi/projects/language-school/**/dist' \
  -C / -czf - "${system_paths[@]}" \
  -C "$STAGING_DIR" \
  RECOVERY-MANIFEST.txt \
  RESTORE-INSTRUCTIONS.txt \
  language-school.git.bundle \
  pocketbase-data.tar.gz \
  pocketbase-data.tar.gz.sha256 \
  | gpg --batch --yes --pinentry-mode loopback \
      --passphrase-file "$FULL_BACKUP_KEY" \
      --symmetric --cipher-algo AES256 \
      --output "$PARTIAL"

mv "$PARTIAL" "$ARCHIVE"
chmod 0600 "$ARCHIVE"
(
  cd "$FULL_BACKUP_DIR"
  sha256sum "$(basename "$ARCHIVE")" > "$(basename "$CHECKSUM")"
  sha256sum -c "$(basename "$CHECKSUM")" >/dev/null
)
chmod 0600 "$CHECKSUM"

gpg --batch --quiet --pinentry-mode loopback \
  --passphrase-file "$FULL_BACKUP_KEY" \
  --decrypt "$ARCHIVE" \
  | tar -tzf - > "$LISTING"

for required_entry in \
  opt/language-school/frontend/index.html \
  opt/language-school/pocketbase/pocketbase \
  etc/language-school/production.env \
  RECOVERY-MANIFEST.txt \
  RESTORE-INSTRUCTIONS.txt \
  language-school.git.bundle \
  pocketbase-data.tar.gz \
  pocketbase-data.tar.gz.sha256; do
  grep -Fxq "$required_entry" "$LISTING" || {
    echo "Full backup validation failed; missing entry: $required_entry" >&2
    exit 1
  }
done

sync
backup_complete=1

mapfile -t full_archives < <(find "$FULL_BACKUP_DIR" -maxdepth 1 -type f -name 'language-school-full-*.tar.gz.gpg' -printf '%f\n' | sort -r)
for (( index=FULL_BACKUP_RETENTION_COUNT; index<${#full_archives[@]}; index++ )); do
  old_archive="$FULL_BACKUP_DIR/${full_archives[$index]}"
  rm -f -- "$old_archive" "$old_archive.sha256"
done

trap - EXIT
rm -rf -- "$STAGING_DIR"

printf 'Full backup created: %s\n' "$ARCHIVE"
printf 'Checksum verified: %s\n' "$CHECKSUM"
printf 'Encrypted archive content verified.\n'
printf 'Embedded PocketBase backup: %s\n' "$(basename "$latest_data_archive")"
