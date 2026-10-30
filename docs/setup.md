# Local development setup

## Requirements

| Tool | Version | Notes |
|---|---|---|
| Docker Desktop | current | Runs MySQL 8.4 and phpMyAdmin. Start it before `make up`. |
| Go | 1.25 | See `backend/go.mod` |
| Node.js | 22 | Pinned in `.mise.toml` |
| pnpm | 10 | Pinned in `.mise.toml` |
| Google Chrome | current | Only for the browser test suites |

## Start everything

```sh
pnpm install
make up
```

`make up` (root `Makefile`):

1. Starts the `mysql` and `phpmyadmin` services from `backend/docker-compose.yml`.
2. Starts the Go API with hot reload (Air, `backend/.air.toml`) on `:8080`, with development
   defaults for `DATABASE_URL` and `JWT_SECRET` set in `backend/Makefile`.
3. Starts the Vite dev server on `:5173`.
4. Waits until both answer, then returns. Process IDs and logs are in `.runtime/`
   (`api.log`, `frontend.log`).

| Command | What it does |
|---|---|
| `make up` / `make down` | Start / stop the whole stack |
| `make status` | Show whether the API and frontend processes are running |
| `make backend-dev` | Run only the API (foreground) |
| `make frontend-dev` | Run only Vite on `:5173` |
| `make db-up` / `make db-down` | Start / stop the Docker database services |
| `make backend-test` | `go test ./...` in `backend/` |
| `make backend-build` | `go build ./...` |
| `make -C backend fmt` | `gofmt` every Go file |

## Environment variables

`backend/.env.example` documents every variable. `make backend-dev` sets development values
inline; when running the API another way, copy the template and export it in your shell (the API
does not read `.env` files itself).

| Variable | Default | Meaning |
|---|---|---|
| `APP_ENV` | `development` | `production` disables development-only responses (e.g. reset tokens in API responses) and enables Gin release mode |
| `HTTP_ADDR` | `:8080` | Listen address |
| `DATABASE_URL` | — (required) | go-sql-driver DSN; keep `parseTime=true&charset=utf8mb4&loc=UTC` |
| `JWT_SECRET` | — (required, ≥ 32 chars) | HMAC key for access tokens |
| `ACCESS_TOKEN_TTL` | `15m` | Access-token lifetime |
| `REFRESH_TOKEN_TTL` | `720h` | Refresh-token lifetime |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS so the session cookie is `Secure` |
| `DOCUMENT_DIR` | `private_documents` | Private upload storage (relative to the API's working directory) |
| `LOGIN_LIMIT_PER_ACCOUNT` | `5` | Failed logins per email + IP per 15 minutes |
| `LOGIN_LIMIT_PER_IP` | `50` | Failed logins per IP per 15 minutes |
| `SIGNUP_LIMIT_PER_IP` | `20` | Register / reset / verify-email calls per IP per hour |
| `TRUSTED_PROXIES` | empty | Comma-separated proxies allowed to set `X-Forwarded-For` |
| `REFRESH_REUSE_GRACE` | `20s` | Window in which a just-rotated refresh token may be reused |

Frontend: `API_PROXY_TARGET` (Vite proxy target, default `http://localhost:8080`) and `PORT`.

The local Docker credentials (`tuitionhub` / `tuitionhub`, root `root`) exist only for the local
container. Never reuse them, or the template's `JWT_SECRET`, anywhere else.

## Database and migrations

- A **new** MySQL volume runs every file in `backend/migrations/` automatically (Docker
  entrypoint).
- For an **existing** database, back it up, then apply pending migrations with the runner:

```sh
cd backend
docker compose exec -T mysql mysqldump -uroot -proot --single-transaction tuitionhub > backups/tuitionhub-$(date +%Y%m%d).sql
DATABASE_URL='tuitionhub:tuitionhub@tcp(127.0.0.1:3306)/tuitionhub?parseTime=true&charset=utf8mb4&loc=UTC' go run ./cmd/migrate -dry-run
DATABASE_URL='tuitionhub:tuitionhub@tcp(127.0.0.1:3306)/tuitionhub?parseTime=true&charset=utf8mb4&loc=UTC' go run ./cmd/migrate
```

The runner records applied files in `schema_migrations`, baselines databases created before it
existed, and refuses files containing `DROP`, `TRUNCATE` or `DELETE FROM`. `backend/backups/` is
git-ignored. More in [database.md](database.md).

## First administrator

Public registration cannot create administrators. Create the first one from `backend/` with the
password supplied through the environment (never on the command line or in a file):

```sh
read -r -s ADMIN_BOOTSTRAP_PASSWORD; export ADMIN_BOOTSTRAP_PASSWORD
DATABASE_URL='...' JWT_SECRET='...' go run ./cmd/bootstrap-admin -name "Your Name" -email "you@example.com"
unset ADMIN_BOOTSTRAP_PASSWORD
```

It refuses to run if any administrator already exists. Sign in at `/admin/login`.

## Email in development

No email provider is configured. On a non-production server the forgot-password and
email-verification endpoints return the token in the response, and the UI shows the link with a
"development server" label. Production needs a provider (see [deployment.md](deployment.md)).
