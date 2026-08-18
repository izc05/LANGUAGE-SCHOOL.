#!/usr/bin/env bash
set -euo pipefail

ORIGIN="${1:-${PUBLIC_ORIGIN:-}}"

if [[ -z "$ORIGIN" ]]; then
  echo 'Usage: verify-production.sh https://academy.example.com' >&2
  echo 'Or export PUBLIC_ORIGIN=https://academy.example.com' >&2
  exit 64
fi

if [[ ! "$ORIGIN" =~ ^https://[^/]+$ ]]; then
  echo 'PUBLIC_ORIGIN must be an HTTPS origin without a trailing slash or path.' >&2
  exit 64
fi

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

pass() {
  printf 'OK  %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

headers_for() {
  local path="$1"
  curl --fail --silent --show-error --head \
    --connect-timeout 10 --max-time 20 \
    "$ORIGIN$path" | tr -d '\r'
}

status_for() {
  local method="$1"
  local path="$2"
  shift 2
  curl --silent --show-error --output /dev/null \
    --connect-timeout 10 --max-time 20 \
    --request "$method" \
    --write-out '%{http_code}' \
    "$@" \
    "$ORIGIN$path"
}

contains_header() {
  local headers="$1"
  local expression="$2"
  printf '%s\n' "$headers" | grep -Eqi "$expression"
}

PUBLIC_HEADERS=$(headers_for '/') || fail 'La Home no responde por HTTPS.'
contains_header "$PUBLIC_HEADERS" '^CF-Ray:' \
  || fail 'No aparece CF-Ray: el hostname no parece estar pasando por Cloudflare.'
contains_header "$PUBLIC_HEADERS" '^Content-Signal: search=yes, ai-input=yes, ai-train=no$' \
  || fail 'La Home no publica la política Content-Signal esperada.'
contains_header "$PUBLIC_HEADERS" '^X-Content-Type-Options: nosniff$' \
  || fail 'Falta X-Content-Type-Options en la Home.'
if contains_header "$PUBLIC_HEADERS" '^X-Robots-Tag:'; then
  fail 'La Home pública no debe publicar X-Robots-Tag privado.'
fi
pass 'Home pública detrás de Cloudflare con Content-Signal correcto.'

ROBOTS_FILE="$TMP_DIR/robots.txt"
curl --fail --silent --show-error \
  --connect-timeout 10 --max-time 20 \
  "$ORIGIN/robots.txt" > "$ROBOTS_FILE" \
  || fail 'robots.txt no responde.'

grep -Fqi 'Content-signal: search=yes, ai-input=yes, ai-train=no, use=reference' "$ROBOTS_FILE" \
  || fail 'robots.txt no contiene la política Content-signal esperada.'
grep -Fqi 'User-agent: GPTBot' "$ROBOTS_FILE" \
  || fail 'robots.txt no contiene la directiva de GPTBot.'
for path in /acceso /admin /alumno /profesor; do
  grep -Fqi "Disallow: $path" "$ROBOTS_FILE" \
    || fail "robots.txt no bloquea $path."
done
pass 'robots.txt conserva búsqueda/AI-input y bloquea entrenamiento y zonas privadas.'

for path in /acceso /admin /alumno /profesor; do
  PRIVATE_HEADERS=$(headers_for "$path") \
    || fail "$path no responde correctamente."
  contains_header "$PRIVATE_HEADERS" '^X-Robots-Tag: noindex, nofollow, noarchive, nosnippet$' \
    || fail "$path no publica X-Robots-Tag privado desde el origen."
  contains_header "$PRIVATE_HEADERS" '^Content-Signal: search=yes, ai-input=yes, ai-train=no$' \
    || fail "$path no conserva Content-Signal."
done
pass 'Rutas privadas protegidas también para crawlers sin JavaScript.'

HEALTH_STATUS=$(status_for GET '/api/health')
[[ "$HEALTH_STATUS" == '200' ]] \
  || fail "/api/health devolvió HTTP $HEALTH_STATUS en lugar de 200."
pass 'PocketBase responde a través del proxy y del Tunnel.'

for path in '/_' '/_/'; do
  ADMIN_STATUS=$(status_for GET "$path")
  [[ "$ADMIN_STATUS" == '404' ]] \
    || fail "$path devolvió HTTP $ADMIN_STATUS; el panel PocketBase debe permanecer oculto."
done
pass 'Panel administrativo nativo de PocketBase no publicado.'

CONTACT_STATUS=$(status_for POST '/api/language-school/contact' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Security Check","email":"security-check@example.invalid","message":"Production verification without Turnstile","website":"","turnstileToken":""}')
[[ "$CONTACT_STATUS" == '400' ]] \
  || fail "El endpoint de contacto sin Turnstile devolvió HTTP $CONTACT_STATUS en lugar de 400."
pass 'Contacto rechaza solicitudes sin token Turnstile.'

BYPASS_STATUS=$(status_for POST '/api/collections/contact_requests/records' \
  -H 'Content-Type: application/json' \
  --data '{"name":"Bypass Check","email":"security-check@example.invalid","message":"Direct collection bypass verification","status":"NEW"}')
case "$BYPASS_STATUS" in
  400|401|403) ;;
  *) fail "El bypass directo de contact_requests devolvió HTTP $BYPASS_STATUS; se esperaba rechazo." ;;
esac
pass 'Alta pública directa de contact_requests bloqueada.'

cat <<'EOF'

VERIFICACIÓN EXTERIOR SUPERADA.

Quedan deliberadamente fuera de este script las pruebas destructivas o ruidosas:
- provocar el rate limit de login;
- provocar el rate limit de contacto;
- bloquear/desbloquear crawlers desde AI Crawl Control;
- inspeccionar Security Events y Turnstile Analytics.

Esas comprobaciones deben hacerse en el panel Cloudflare durante la puesta en producción.
EOF
