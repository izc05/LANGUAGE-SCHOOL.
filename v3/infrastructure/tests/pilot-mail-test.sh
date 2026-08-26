#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MAIL_DIR="$(cd -- "$SCRIPT_DIR/../pilot-mail" && pwd)"
SERVER="$MAIL_DIR/pilot-mail-server.mjs"
CLI="$MAIL_DIR/language-school-pilot-mail.mjs"
TMP_DIR="$(mktemp -d)"
SOCKET="$TMP_DIR/control.sock"
EXPECTED_OTP="$TMP_DIR/expected-otp"
SERVER_LOG="$TMP_DIR/server.log"
SERVER_PID=''

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

SMTP_PORT="$(node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})")"

if DEPLOYMENT_MODE=production \
  PILOT_MAIL_CAPTURE=true SMTP_ENABLED=true SMTP_HOST=127.0.0.1 SMTP_PORT="$SMTP_PORT" SMTP_TLS=false \
  PILOT_MAIL_CONTROL_SOCKET="$SOCKET" node "$SERVER" >"$SERVER_LOG" 2>&1; then
  echo 'PILOT mail capture started in production mode.' >&2
  exit 1
fi
grep -Fq 'DEPLOYMENT_MODE must be pilot' "$SERVER_LOG"

DEPLOYMENT_MODE=pilot \
PILOT_MAIL_CAPTURE=true \
SMTP_ENABLED=true \
SMTP_HOST=127.0.0.1 \
SMTP_PORT="$SMTP_PORT" \
SMTP_TLS=false \
SMTP_USERNAME= \
SMTP_PASSWORD= \
SMTP_AUTH_METHOD= \
PILOT_MAIL_CONTROL_SOCKET="$SOCKET" \
node "$SERVER" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _attempt in {1..40}; do
  [[ -S "$SOCKET" ]] && break
  sleep 0.1
done
[[ -S "$SOCKET" ]] || { cat "$SERVER_LOG" >&2; echo 'PILOT mail control socket was not created.' >&2; exit 1; }

SMTP_PORT="$SMTP_PORT" EXPECTED_OTP="$EXPECTED_OTP" node <<'NODE'
const crypto = require('node:crypto')
const fs = require('node:fs')
const net = require('node:net')

const otp = String(crypto.randomInt(100000, 1000000))
fs.writeFileSync(process.env.EXPECTED_OTP, otp, { mode: 0o600 })
const socket = net.createConnection({ host: '127.0.0.1', port: Number(process.env.SMTP_PORT) })
let step = 0
socket.setEncoding('utf8')
socket.on('data', () => {
  if (step === 0) socket.write('EHLO pilot-test.local\r\n')
  else if (step === 1) socket.write('MAIL FROM:<pilot@school.example.invalid>\r\n')
  else if (step === 2) socket.write('RCPT TO:<admin@example.invalid>\r\n')
  else if (step === 3) socket.write('DATA\r\n')
  else if (step === 4) socket.write(`Subject: Pilot OTP\r\nTo: admin@example.invalid\r\n\r\nYour one-time code is ${otp}.\r\n.\r\n`)
  else if (step === 5) socket.write('QUIT\r\n')
  step += 1
})
socket.on('error', (error) => { console.error(error.message); process.exit(1) })
socket.on('close', () => process.exit(step >= 6 ? 0 : 1))
NODE

OTP="$(cat "$EXPECTED_OTP")"
CLI_OUTPUT="$(sudo env PILOT_MAIL_CONTROL_SOCKET="$SOCKET" node "$CLI" latest admin@example.invalid)"
grep -Fq 'Recipient: admin@example.invalid' <<<"$CLI_OUTPUT"
grep -Fq "OTP: $OTP" <<<"$CLI_OUTPUT"

sudo env PILOT_MAIL_CONTROL_SOCKET="$SOCKET" node "$CLI" clear >/dev/null
if sudo env PILOT_MAIL_CONTROL_SOCKET="$SOCKET" node "$CLI" latest admin@example.invalid >"$TMP_DIR/after-clear.log" 2>&1; then
  echo 'PILOT mail clear left a retrievable message.' >&2
  exit 1
fi
grep -Fq 'message_not_found' "$TMP_DIR/after-clear.log"

echo 'PILOT mail capture tests: PASS'
