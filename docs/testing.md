# Testing

| Suite | Where | What it covers |
|---|---|---|
| Go unit tests | `backend/internal/**/*_test.go` | Auth (admin bootstrap, sqlmock), configuration, rate limiter, image validation (real, forged and oversized images), verification rules |
| Go integration tests | `backend/internal/integration` (build tag `integration`) | Verification lifecycle and stored files, global data-integrity invariants, rate limiting, refresh-token reuse, suspension, role restrictions, SQL-metacharacter safety. **Refuses to run unless the database name ends in `_e2e`.** |
| API end to end | `tests/verification-e2e.mjs` | Authentication, cookie sessions, verification and pictures, admin review, interviews, users, notifications, permissions |
| API end to end | `tests/platform-e2e.mjs` | All five role journeys over HTTP: discovery, links, posts, applications, chat, messaging, demo class, agreement, classroom, payments, reviews, coaching, support, admin platform, enforced settings |
| Browser end to end | `tests/browser-e2e.mjs` | Verification UI, admin review, suspension, notifications, session storage, every screen of every role at 375/768/1280 px (crashes, horizontal overflow, console errors) |
| Browser end to end | `tests/journeys-browser.mjs` | Cross-role journeys driven through the UI, from linking a child to grading homework and coaching fees |
| Static checks | `npx tsc --noEmit -p .`, `pnpm build`, `gofmt -l`, `go vet` | Types, production bundle, formatting |

`tests/legacy/` holds the original prototype scripts; they no longer run.

## Unit tests and static checks

```sh
cd backend && go test ./... && go vet ./... && gofmt -l .
cd .. && npx tsc --noEmit -p . && pnpm build
```

## Isolated test database

Integration, API and browser suites create accounts and decisions, so they must use a separate
database, never one with real users.

```sh
cd backend
docker compose exec -T mysql mysql -uroot -proot -e "CREATE DATABASE tuitionhub_e2e CHARACTER SET utf8mb4; GRANT ALL ON tuitionhub_e2e.* TO 'tuitionhub'@'%';"
export E2E_DATABASE_URL='tuitionhub:tuitionhub@tcp(127.0.0.1:3306)/tuitionhub_e2e?parseTime=true&charset=utf8mb4&loc=UTC'
DATABASE_URL="$E2E_DATABASE_URL" go run ./cmd/migrate
# a test administrator for that database only
read -r -s ADMIN_BOOTSTRAP_PASSWORD; export ADMIN_BOOTSTRAP_PASSWORD
DATABASE_URL="$E2E_DATABASE_URL" JWT_SECRET=<32+ random chars> go run ./cmd/bootstrap-admin -name "E2E Admin" -email e2e-admin@tuitionhub.test
export E2E_ADMIN_EMAIL=e2e-admin@tuitionhub.test E2E_ADMIN_PASSWORD="$ADMIN_BOOTSTRAP_PASSWORD"
```

## Running the suites

```sh
# from backend/: integration tests
go test -tags integration ./internal/integration

# from backend/: a second API on :8090 against the test database
DATABASE_URL="$E2E_DATABASE_URL" JWT_SECRET=<32+ random chars> HTTP_ADDR=:8090 \
  DOCUMENT_DIR=/tmp/tuitionhub-e2e-docs SIGNUP_LIMIT_PER_IP=1000 REFRESH_REUSE_GRACE=2s go run ./cmd/server

# from the repository root, in another terminal: a frontend for that API
API_PROXY_TARGET=http://localhost:8090 PORT=5174 pnpm dev

# then
export E2E_API=http://localhost:8090 E2E_WEB=http://127.0.0.1:5174
node tests/verification-e2e.mjs
node tests/platform-e2e.mjs
node tests/browser-e2e.mjs
node tests/journeys-browser.mjs
```

- `SIGNUP_LIMIT_PER_IP` is raised only on the test API so repeated runs are not throttled; the
  login limit is tested at its default.
- `REFRESH_REUSE_GRACE=2s` lets the suite prove both behaviours: replay within the window gets a
  fresh session, replay after it revokes every session.
- Browser suites use Chrome at `/Applications/Google Chrome.app/...` by default; set
  `CHROME_PATH` elsewhere.
- Each run uses random emails, so suites can be re-run without cleaning the database.

## Latest verified results

Recorded in [PROGRESS.md](../PROGRESS.md) with the commit they apply to.
