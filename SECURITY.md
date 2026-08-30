# Security Policy · Language School

## Production security rules

Language School must fail closed in production.

- Production builds must use `VITE_APP_MODE=connected`.
- PocketBase must listen only on loopback (`127.0.0.1`).
- PocketBase superuser credentials, Cloudflare tokens, SMTP passwords and other secrets must never be committed to Git.
- No secret may be stored in a `VITE_*` variable because Vite exposes those values to the browser bundle.
- `/_/` must remain blocked at the public reverse proxy.
- Private academic files must remain protected by PocketBase collection rules.
- Administrative authorization must be enforced in PocketBase, not only by frontend route guards.
- Production changes should go through a pull request with CI checks green before merge.

## Files that must never be committed

- `.env` and `.env.*` except approved `.env.example` templates
- `pb_data/` and PocketBase backups
- database files
- real student uploads
- private keys and certificates
- Cloudflare tunnel credentials or tokens
- SMTP credentials
- production administrator or superuser passwords

## Dependency and supply-chain controls

- Dependabot is enabled for frontend, E2E and GitHub Actions dependencies.
- Production dependency audits must reject high or critical findings before release unless explicitly reviewed.
- Downloaded PocketBase release artifacts must be checked against the pinned SHA-256 values before execution.

## Security headers

The production reverse proxy must keep at least:

- Content-Security-Policy
- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
- Permissions-Policy

Any relaxation required for videoconferencing providers must be limited to the exact provider origins needed by the selected integration.

## Reporting a vulnerability

Do not publish credentials, personal data or exploit details in a public GitHub issue. Report suspected security problems privately to the repository owner so they can be investigated before disclosure.
