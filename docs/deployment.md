# Deployment

TuitionHub has **not been deployed**. This repository contains no hosting configuration, and
there is no public URL. This page lists what a production deployment needs, based on how the
code works today.

## Components

| Component | Notes |
|---|---|
| Frontend | `pnpm build` produces static files in `dist/` (serve them with SPA fallback to `index.html`) |
| API | `go build -o tuitionhub-api ./cmd/server` from `backend/`; a single binary configured by environment variables |
| Database | MySQL 8 with `utf8mb4`; apply migrations with `go run ./cmd/migrate` (or a built `migrate` binary) |
| File storage | A persistent, backed-up directory for `DOCUMENT_DIR` (verification pictures and classroom files) |

## Required configuration

- `APP_ENV=production` (release mode; development-only token responses disabled).
- `DATABASE_URL` with dedicated credentials (not the local Docker ones).
- `JWT_SECRET`: at least 32 random characters, stored in a secret manager.
- HTTPS everywhere and `COOKIE_SECURE=true`.
- Serve the frontend and `/api` from the **same origin** (for example a reverse proxy routing
  `/api/` to the API), because the session cookie is `SameSite=Strict` and the API sends no CORS
  headers.
- `TRUSTED_PROXIES` set to the reverse proxy's address so rate limits see real client IPs.
- A process manager or container platform that restarts the API.
- Backups for MySQL and `DOCUMENT_DIR`.

## Missing before production

| Item | Why it matters |
|---|---|
| Email provider (SMTP or API) | Password reset and email verification send no email today; in production users cannot reset passwords. Needs code to send mail plus credentials. |
| SMS gateway | Not implemented; needed only if phone verification/OTP is wanted. |
| Payment gateway (e.g. SSLCommerz, bKash) | Fees are tracking-only; collecting money online needs a merchant account and integration. |
| Shared rate-limit store | Limits are per process; multiple API instances need a shared store (e.g. Redis). |
| Monitoring and log retention | The API logs to stdout; nothing collects or alerts on it. |
| Off-site file storage and malware scanning | Uploads are on local disk without scanning. |

## First deployment outline

1. Provision MySQL, create the database and user, run `cmd/migrate`.
2. Create the first administrator with `cmd/bootstrap-admin`.
3. Run the API with the configuration above behind an HTTPS reverse proxy.
4. Serve `dist/` from the same origin; route `/api/` to the API.
5. Verify `/health`, sign-up, sign-in (check the cookie is `Secure; HttpOnly`), verification upload
   and admin review.
