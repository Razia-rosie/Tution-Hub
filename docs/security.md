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
  administrator APIs and others ([API_DOCUMENTATION.md](API_DOCUMENTATION.md)).
- Object-level checks: classroom access levels (owner, member, approved guardian, admin);
  conversations only for participants; coaching data always filtered by the calling centre;
  guardian access only through links the student approved. Objects the caller may not see return
  404 so identifiers cannot be probed.

## Uploads and private files

- Verification pictures and profile photos must be real JPEG/PNG/WebP images: content is sniffed,
  the header is parsed (≤ 40 MP to stop decompression bombs) and the whole image is decoded.
  Classroom materials and submissions may also be PDF (signature and end marker checked). Limit:
  `MAX_UPLOAD_MB` (10 MB by default, 4 MB in production because of Vercel's body limit), enforced
  before parsing.
- Files get random UUID keys. With `FILE_STORAGE=disk` they are stored under `DOCUMENT_DIR` with
  `0600` permissions outside the web root; with `FILE_STORAGE=database` (production) they are rows in
  `stored_files`. Either way they are served only through authorised endpoints with
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
On platforms whose edge overwrites a client-IP header, `CLIENT_IP_HEADER` names it (`X-Real-IP` on
Vercel). Limits are in memory per API instance, so on serverless hosting they are per running
instance rather than global.

## Data protection

- Contact details (email, phone) are shared between a tutor and a family only after both confirm a
  tuition. Public listings never include them.
- SQL is always parameterised; free-text search escapes `LIKE` wildcards.
- `.env`, uploads (`private_documents/`), database backups (`backend/backups/`) and runtime logs
  (`.runtime/`) are git-ignored.
- Failed logins on existing accounts are audited and feed the suspicious-activity list.

## Secrets

- Real values live only in git-ignored files (`backend/.env.local`, `backend/.env.tidb`,
  `.env.demo.local`) or in the hosting platform's secret settings (Vercel "Sensitive" variables).
  Templates (`backend/.env.example`, `.env.example`) contain placeholders only.
- The production `JWT_SECRET` and database credentials are unique to production.
- The demo-account passwords in [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md) are public on purpose; those
  accounts exist only in local development databases and must never be loaded into production.
- A scan of all 39 commits (1 Nov 2026) found no real credentials, private keys or tokens in the
  repository history.

## Production settings (in place)

HTTPS (Vercel), `COOKIE_SECURE=true`, `APP_ENV=production`, a unique random `JWT_SECRET`, TLS to
TiDB, `CLIENT_IP_HEADER=X-Real-IP`, uploads in the database. Not yet in place: backups, monitoring,
an email provider, and a shared rate-limit store. See [DEPLOYMENT.md](DEPLOYMENT.md).

To report a vulnerability, see [SECURITY.md](../SECURITY.md).
