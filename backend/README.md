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
