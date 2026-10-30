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

## Workflow API

The additive workflow schema is in `migrations/002_workflows.sql`. Existing
records are preserved. It can be applied to an existing database with:

```sh
docker compose exec -T mysql mysql -uroot -p tuitionhub < migrations/002_workflows.sql
```

Authenticated workflow endpoints are under `/api/v1/workflow`:

- `GET /dashboard`
- `PUT /profile`
- `POST /verification/submit`
- `POST /verification/documents` (JPEG, PNG, or WebP only; max 10 MB)
- `GET /notifications`
- `GET` and `POST /relationships`
- `GET /tuition`

Administrator verification review and interview endpoints are under
`/api/v1/workflow/admin`:

- `GET /verifications?status=&role=` - list persisted applications with
  applicant/profile/interview details
- `GET /verifications/:id/documents` - list private document metadata
- `POST /verifications/:id/decision` - approve, reject, or request
  resubmission; rejection and resubmission require a reason of at least ten
  characters
- `POST /verifications/:id/interviews` - schedule an online or in-person
  interview
- `POST /verifications/:id/interviews/:interviewID/outcome` - record a
  completed or cancelled scheduled interview

These endpoints require an authenticated user whose role is `admin`.
Application transitions, ownership, and document access are checked by the
backend. Identity documents are written outside the public web root with
restrictive filesystem permissions.
The storage directory is `DOCUMENT_DIR` (default `private_documents`, relative
to the API's working directory) and is git-ignored. Documents can only be
uploaded or replaced while the application is `pending` or
`resubmission_required`.

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

## End-to-end workflow test

`tests/verification-e2e.mjs` drives the whole verification workflow over HTTP
(registration, tokens, profile, submission, document upload rules, admin
review, interviews, role permissions). It creates new accounts with random
emails and records decisions, so run it against a separate database, never
your development data:

```sh
# one-time: create and migrate an isolated database (as MySQL root)
docker compose exec -T mysql mysql -uroot -proot -e "CREATE DATABASE tuitionhub_e2e; GRANT ALL ON tuitionhub_e2e.* TO 'tuitionhub'@'%';"
docker compose exec -T mysql mysql -uroot -proot tuitionhub_e2e < migrations/001_auth.sql
docker compose exec -T mysql mysql -uroot -proot tuitionhub_e2e < migrations/002_workflows.sql

# run a second API on :8090 against it, bootstrap its admin, then:
E2E_API=http://localhost:8090 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... node ../tests/verification-e2e.mjs
```

To click through the same database in the browser, start Vite with
`API_PROXY_TARGET=http://localhost:8090 PORT=5174 pnpm dev`.

The older `tests/*-journey-*.mjs` and `*-sweep-*.mjs` puppeteer scripts predate
real authentication: they open `/app/...` without signing in and drive the
removed "Demo controls" drawer, so they no longer run as written.
