# Security

## Authentication

- Passwords: bcrypt (default cost). Login for an unknown email compares against a dummy hash so
  timing does not reveal registered emails; the response is identical (401).
- Access token: HS256 JWT signed with `JWT_SECRET`, 15 minutes.
- Refresh token: 32 random bytes, stored only as a SHA-256 hash, 30 days, rotated on every use.
- Password reset and email-verification tokens: random, hashed, single use, 1 h / 24 h.
- Admin accounts are created only by `cmd/bootstrap-admin` (password from the environment).

## Browser sessions

- Clients send `X-Session-Mode: cookie`; the refresh token is then set as cookie `th_refresh`
  (`HttpOnly; SameSite=Strict; Path=/api/v1/auth`, plus `Secure` when `COOKIE_SECURE=true`) and is
  never visible to page scripts. The access token is kept only in memory; a page reload performs a
  silent refresh.
- CSRF: cookie-based refresh and logout require the custom `X-Session-Mode` header, which a
  cross-site page cannot send without a CORS preflight (the API serves no CORS headers).
- Reuse detection: presenting a rotated refresh token after `REFRESH_REUSE_GRACE` (default 20 s)
  revokes every session of the account. Within the window it is treated as a navigation or
  multi-tab race and gets a fresh session. Logout, suspension and password reset also expire the
  affected tokens so the window cannot revive them.

## Authorization

- `RequireAuth` re-reads role and status on every request; suspended accounts are refused
  immediately (403) and the browser signs out.
- Role checks guard verification (tutor/coaching only), coaching APIs, tutor applications,
  administrator APIs and others ([api.md](api.md)).
- Object-level checks: classroom access levels (owner, member, approved guardian, admin);
  conversations only for participants; coaching data always filtered by the calling centre;
  guardian access only through links the student approved. Objects the caller may not see return
  404 so identifiers cannot be probed.

## Uploads and private files

- Verification pictures and profile photos must be real JPEG/PNG/WebP images: content is sniffed,
  the header is parsed (≤ 40 MP to stop decompression bombs) and the whole image is decoded.
  Classroom materials and submissions may also be PDF (signature and end marker checked). Limit:
  10 MB, enforced before parsing.
- Files are stored under `DOCUMENT_DIR` with random UUID names and `0600` permissions, outside
  the web root, and are served only through authorised endpoints with
  `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff` and a sandboxing CSP.
- Administrator views of verification documents are audited.

## Abuse protection

| Limit | Default |
|---|---|
| Failed logins per email + IP | 5 per 15 min (then 429 with `Retry-After`) |
| Failed logins per IP | 50 per 15 min |
| Register / reset / verify-email per IP | 20 per hour |
| Public contact form per IP | 10 per hour |
| Tutor applications per day | 20 (admin setting) |

`X-Forwarded-For` is honoured only from `TRUSTED_PROXIES`, so clients cannot spoof their address.
Limits are in memory per API process.

## Data protection

- Contact details (email, phone) are shared between a tutor and a family only after both confirm a
  tuition. Public listings never include them.
- SQL is always parameterised; free-text search escapes `LIKE` wildcards.
- `.env`, uploads (`private_documents/`), database backups (`backend/backups/`) and runtime logs
  (`.runtime/`) are git-ignored.
- Failed logins on existing accounts are audited and feed the suspicious-activity list.

## Hardening checklist for production

See [deployment.md](deployment.md): HTTPS with `COOKIE_SECURE=true`, a random `JWT_SECRET`,
`APP_ENV=production`, `TRUSTED_PROXIES` set to the reverse proxy, real database credentials,
backups of MySQL and `DOCUMENT_DIR`, and a shared store if more than one API instance runs.

To report a vulnerability, see [SECURITY.md](../SECURITY.md).
