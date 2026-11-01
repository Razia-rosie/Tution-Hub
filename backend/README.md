# TuitionHub backend

The backend is a Go API built with Gin, `sqlx`, MySQL 8, bcrypt, and JWT. It
currently provides the shared application foundation and authentication module;
domain modules can be added under `internal/` without changing the server
bootstrap.

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and export those values in
   your shell. The API intentionally does not load `.env` files in production.
2. Start MySQL and phpMyAdmin:

   ```sh
   make db-up
   ```

3. Start the API:

   ```sh
   make backend-dev
   ```

MySQL is available on `localhost:3306`, phpMyAdmin at
http://localhost:8081, and the API at http://localhost:8080. phpMyAdmin login
is `tuitionhub` / `tuitionhub` (or `root` / `root`).

Use `make up` for the development stack. It starts MySQL and phpMyAdmin in
Docker, then starts the Go API and Vite frontend locally in the background so
the command returns to your shell after readiness checks pass. Go uses Air for
hot reload and Vite provides frontend hot reload. Use `make status` to inspect
the service processes and `make down` to stop them. Logs are written to
`.runtime/api.log` and `.runtime/frontend.log`.

Docker Desktop must be open and fully started before running these commands. On
macOS, the Makefile also detects Docker Desktop's app-bundled Compose plugin
when the standalone `docker compose` command is not registered.

The frontend is available at http://localhost:5173 and the API at
http://localhost:8080.

The first `make up` downloads the pinned Air hot reload tool automatically.

## Authentication endpoints

All endpoints are under `/api/v1/auth`:

- `POST /register` - create a tutor, student, parent, or coaching account
- `POST /login` - issue a short-lived access token and rotating refresh token
- `POST /refresh` - rotate a refresh token
- `POST /logout` - revoke a refresh token
- `GET /me` - return the authenticated user (`Authorization: Bearer ...`)
- `POST /forgot-password` - create a one-hour reset token; development returns
  `development_token` until an email provider is configured
- `POST /reset-password` - consume a reset token and revoke existing sessions
- `POST /verify-email/request` - request an email verification token
- `POST /verify-email` - consume an email verification token

Passwords are never stored in plaintext. Refresh and reset tokens are stored
as SHA-256 hashes, and the migration is automatically applied by MySQL's
container initialization.

## Verification (manual, picture-based)

Only **private tutors** and **coaching centres** are verified. Students and
parents start `active`. Verification is entirely manual: applicants upload
pictures of their documents and an administrator looks at them and decides.
There is no OCR, AI scanning, face matching or automatic approval anywhere.

Flow: register → upload pictures (creates a `draft`) → fill details → submit →
`pending` → admin review → **approve** (account `active`, restricted features
unlock), **reject** (final; the reason is shown to the applicant) or **request
corrections** (`resubmission_required`; the applicant may replace pictures and
edit details, then resubmit, which returns the application to `pending`).
An optional interview can be scheduled while the application is pending.

Required pictures:

| Role     | Type             | Required |
|----------|------------------|----------|
| tutor    | `identity`       | yes      |
| tutor    | `education`      | no       |
| coaching | `trade_license`  | yes      |
| coaching | `owner_identity` | yes      |

Submission is refused (422, with a `missing` list) until the required pictures
and the profile (name, education/registration, subjects, classes, areas) exist.
Pictures and profile are frozen from submission until corrections are
requested. Uploads must be real JPEG, PNG or WebP images of at most
`MAX_UPLOAD_MB` (10 MB by default, 4 MB on Vercel) and 40 megapixels: the bytes are sniffed and fully decoded, so renamed PDFs, Word
files, SVGs, GIFs, truncated or header-only files are rejected. Pictures get
random UUID keys and are stored outside the web root as `0600` files
(`FILE_STORAGE=disk`) or in the `stored_files` table (`FILE_STORAGE=database`),
served only
to the owner and administrators (others get 404) with `Cache-Control: no-store`,
`nosniff` and a sandboxing CSP. Every upload, admin view, decision, interview
and suspension is written to `audit_logs`.

## Workflow API

Authenticated endpoints under `/api/v1/workflow`:

- `GET /dashboard` - account, profile, verification, own pictures, requirements
- `PUT /profile`
- `POST /verification/documents` - multipart `document_type` + `document`
- `GET /verification/documents/:id` - the picture (owner or admin)
- `POST /verification/submit`
- `GET /notifications`, `POST /notifications/read` (`{"id"}` or `{}` for all)
- `GET` and `POST /relationships`
- `GET /tuition` (active accounts only)

Administrator endpoints under `/api/v1/workflow/admin` (role `admin` only):

- `GET /verifications?status=&role=` - submitted applications (drafts hidden)
  with profile, interviews, submission and picture counts
- `GET /verifications/:id/documents`, `GET /verifications/:id/history`
- `POST /verifications/:id/decision` - `approved`, `rejected` or
  `resubmission_required`; the last two need a reason of 10+ characters
- `POST /verifications/:id/interviews`, `.../interviews/:interviewID/outcome`
- `GET /stats`, `GET /users?role=&status=&q=&limit=&offset=`
- `POST /users/:id/suspend` (`{"reason"}`), `POST /users/:id/reactivate`
- `GET /audit-logs?action=&limit=&offset=`

Further APIs for the marketplace, messaging, tuitions, classrooms, coaching
and administration live in `internal/platform` (routes in `routes.go`).

## Migrations

`go run ./cmd/migrate` applies pending files from `migrations/` in order and
records them in `schema_migrations`. Databases created before the tool are
baselined (001/002 recorded without re-running). It refuses any file with
DROP/TRUNCATE/DELETE, so it only ever adds, and it works on MySQL and TiDB
(the `SELECT ... INTO @var` guards run as `SET @var = (SELECT ...)`). Back up first:

```sh
docker compose exec -T mysql mysqldump -uroot -proot --single-transaction tuitionhub > backups/tuitionhub-$(date +%Y%m%d).sql
DATABASE_URL='tuitionhub:tuitionhub@tcp(127.0.0.1:3306)/tuitionhub?parseTime=true&charset=utf8mb4&loc=UTC' go run ./cmd/migrate -dry-run
DATABASE_URL='...' go run ./cmd/migrate
```

## Security configuration

| Variable | Default | Meaning |
|---|---|---|
| `LOGIN_LIMIT_PER_ACCOUNT` | 5 | failed logins per email+IP per 15 min before 429 |
| `LOGIN_LIMIT_PER_IP` | 50 | failed logins per IP per 15 min |
| `SIGNUP_LIMIT_PER_IP` | 20 | register / reset / verify-email calls per IP per hour |
| `TRUSTED_PROXIES` | empty | comma-separated proxies allowed to set `X-Forwarded-For` |
| `DOCUMENT_DIR` | `private_documents` | picture storage, outside the web root (`FILE_STORAGE=disk`) |
| `FILE_STORAGE` | `disk` | `disk` or `database` (`stored_files` table) |
| `MAX_UPLOAD_MB` | `10` | per-file upload limit |
| `CLIENT_IP_HEADER` | empty | client-IP header set by the hosting edge (`X-Real-IP` on Vercel) |
| `COOKIE_SECURE` | `false` | set `true` behind HTTPS so the session cookie is Secure |
| `REFRESH_REUSE_GRACE` | `20s` | how long a just-rotated refresh token may be presented again (navigation / multi-tab races) before reuse is treated as theft |

**Sessions.** The web app sends `X-Session-Mode: cookie` on sign-in: the
refresh token is then set as an `HttpOnly; SameSite=Strict` cookie scoped to
`/api/v1/auth` and is never visible to page scripts, and the short-lived access
token is kept only in memory (a reload refreshes silently). Refresh and logout
from the cookie require that same header, which a cross-site page cannot send,
so they are not exposed to CSRF. Other clients may keep using the refresh token
in the JSON body. Refresh tokens rotate on every use; presenting a rotated
token after the grace period revokes every session of the account.

Rate limits are in memory (per API process). Suspension, reuse of a rotated
refresh token (which revokes all of that user's sessions) and deleted accounts
take effect on the next request, because every authenticated request checks
the account in the database.

## Initial administrator bootstrap

Public registration cannot create administrator accounts. To create the first
administrator, run the deployment-only CLI from the backend directory with a
password supplied through the environment. The command is authorized by local
OS access and the configured database credentials; it has no HTTP endpoint or
separate bootstrap secret:

```sh
read -r -s ADMIN_BOOTSTRAP_PASSWORD
export ADMIN_BOOTSTRAP_PASSWORD
go run ./cmd/bootstrap-admin \
  -name "Your Name" \
  -email "your-admin-email@example.com"
unset ADMIN_BOOTSTRAP_PASSWORD
```

The command uses the existing `DATABASE_URL` and requires the same
`JWT_SECRET` configuration as the API. It acquires a MySQL advisory lock,
checks that no administrator exists, hashes the password with bcrypt, and
inserts one `admin` user. It refuses to run when any administrator already
exists and never changes an existing password. The password is not logged,
stored in configuration, or sent to the frontend.

For the Docker/MySQL setup, start the database first and run the command on
the host from `backend/`:

```sh
make db-up
export DATABASE_URL='tuitionhub:tuitionhub@tcp(127.0.0.1:3306)/tuitionhub?parseTime=true&charset=utf8mb4&loc=UTC'
export JWT_SECRET='use-the-same-local-development-secret-as-the-api'
read -r -s ADMIN_BOOTSTRAP_PASSWORD
export ADMIN_BOOTSTRAP_PASSWORD
go run ./cmd/bootstrap-admin -name "Your Name" -email "your-admin-email@example.com"
unset ADMIN_BOOTSTRAP_PASSWORD
```

If the command reports that an administrator already exists, stop; it will
not reset or modify that account. After it succeeds, sign in through the
existing frontend login and open `/app/admin/verification`. A successful
database insert alone is not an end-to-end verification of the admin
workflow.

## Tests

All destructive tests run against a separate `tuitionhub_e2e` database. The
integration tests refuse to run against any database whose name does not end
in `_e2e`.

```sh
# one-time: create and migrate the isolated database (as MySQL root)
docker compose exec -T mysql mysql -uroot -proot -e "CREATE DATABASE tuitionhub_e2e; GRANT ALL ON tuitionhub_e2e.* TO 'tuitionhub'@'%';"
docker compose exec -T mysql mysql -uroot -proot tuitionhub_e2e < migrations/001_auth.sql
docker compose exec -T mysql mysql -uroot -proot tuitionhub_e2e < migrations/002_workflows.sql
export E2E_DATABASE_URL='tuitionhub:tuitionhub@tcp(127.0.0.1:3306)/tuitionhub_e2e?parseTime=true&charset=utf8mb4&loc=UTC'

# one-time: an admin for the test database only
JWT_SECRET=... DATABASE_URL="$E2E_DATABASE_URL" ADMIN_BOOTSTRAP_PASSWORD=... go run ./cmd/bootstrap-admin -name "E2E Admin" -email e2e-admin@tuitionhub.test
export E2E_ADMIN_EMAIL=e2e-admin@tuitionhub.test E2E_ADMIN_PASSWORD=...

go test ./...                                         # unit tests
go test -tags integration ./internal/integration     # integration tests (real MySQL)

# a second API on :8090 against the test database
DATABASE_URL="$E2E_DATABASE_URL" JWT_SECRET=... HTTP_ADDR=:8090 DOCUMENT_DIR=/tmp/e2e-docs SIGNUP_LIMIT_PER_IP=1000 go run ./cmd/server

# from the repository root
E2E_API=http://localhost:8090 node tests/verification-e2e.mjs            # API end to end
API_PROXY_TARGET=http://localhost:8090 PORT=5174 pnpm dev                 # frontend for the test API
E2E_API=http://localhost:8090 node tests/platform-e2e.mjs                 # all role journeys over HTTP
E2E_API=http://localhost:8090 node tests/family-e2e.mjs                   # parent and student verification over HTTP
E2E_WEB=http://127.0.0.1:5174 node tests/browser-e2e.mjs                  # browser end to end (Chrome)
E2E_WEB=http://127.0.0.1:5174 E2E_API=http://localhost:8090 node tests/journeys-browser.mjs  # cross-role journeys in the UI
npx tsc --noEmit -p . && pnpm build                                       # type-check and production build
```

`SIGNUP_LIMIT_PER_IP` is raised only on the test API so repeated runs from one
machine are not throttled; the login limit is tested at its default.
`tests/legacy/` holds the original puppeteer scripts. They drove the removed
demo-controls drawer without signing in and no longer run; the browser suite
above replaces them.
