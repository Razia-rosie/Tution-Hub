# Testing

| Suite | Where | What it covers |
|---|---|---|
| Go unit tests | `backend/internal/**/*_test.go` | Auth (admin bootstrap, sqlmock), configuration, rate limiter, image validation (real, forged and oversized images), verification rules |
| Go integration tests | `backend/internal/integration` (build tag `integration`) | Verification lifecycle and stored files, global data-integrity invariants, rate limiting, refresh-token reuse, suspension, role restrictions, SQL-metacharacter safety. **Refuses to run unless the database name ends in `_e2e`.** |
| API end to end | `tests/verification-e2e.mjs` | Authentication, cookie sessions, verification and pictures, admin review, interviews, users, notifications, permissions |
| API end to end | `tests/platform-e2e.mjs` | All five role journeys over HTTP: discovery, links, posts, applications, chat, messaging, demo class, agreement, classroom, payments, reviews, coaching, support, admin platform, enforced settings |
| Browser end to end | `tests/browser-e2e.mjs` | Verification UI, admin review, suspension, notifications, session storage, every screen of every role at 375/768/1280 px (crashes, horizontal overflow, console errors) |
| Browser end to end | `tests/journeys-browser.mjs` | Cross-role journeys driven through the UI, from linking a child to grading homework and coaching fees |
| Demo-account checks | `tests/demo-accounts.mjs` | The eight seeded demo accounts: sign-in, sessions, permissions, connected records, reversible create/update/delete ([DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md)) |
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

## Results

### Automated (1 Nov 2026, branch `feature/free-tier-deploy`)

Run locally on macOS (Apple M4), Go 1.25, Node 26, MySQL 8.4 in Docker, Chrome. The API suites and
browser suites ran against an API with `FILE_STORAGE=database` (the production storage mode).

| Check | Result |
|---|---|
| `gofmt -l .`, `go vet ./...` (also with the `integration` tag) | clean |
| `go test ./...` (7 packages: migrate, auth, config, database, filestore, ratelimit, workflow) | pass |
| `go test -tags integration ./internal/integration` | pass |
| `tests/verification-e2e.mjs` | 119 / 119 |
| `tests/platform-e2e.mjs` | 169 / 169 |
| `tests/browser-e2e.mjs` | 60 / 60 |
| `tests/journeys-browser.mjs` | 34 / 34 |
| `tests/demo-accounts.mjs --api-only` (development database, disk storage) | 86 / 86 |
| `npx tsc --noEmit -p .`, `pnpm build` | clean |

On 31 Oct one `browser-e2e` run failed one check ("admin: tutor approved") because the confirmation
text appeared after the wait; the approval itself succeeded and two immediate re-runs passed 60/60.

### Live deployment checks (1 Nov 2026)

Against https://tuitionhub-omega.vercel.app (TiDB Cloud Starter), with one test tutor account:

| # | Check | Result |
|---|---|---|
| 1 | Sign up as tutor; no development token in the response | pass |
| 2 | Login sets `th_refresh` as `HttpOnly; Secure; SameSite=Strict`; refresh token not in the body | pass |
| 3–4 | `/auth/me`; refresh through the cookie | pass |
| 5 | Save profile | pass |
| 6 | Upload an ID picture (stored in TiDB) | pass |
| 7 | Picture over 4 MB rejected with "document must be 4 MB or smaller" | pass |
| 8 | Download is byte-identical with `Cache-Control: private, no-store` | pass |
| 9 | Submit for review (`pending`) | pass |
| 10 | Picture without login returns 401 | pass |
| 11 | Unapproved tutor not in public list | pass |
| 12 | Logout | pass |
| 13 | Administrator approval in the UI; the tutor then appears in public search (Physics, Dhaka) | pass |

The other features (marketplace, messaging, tuitions, classrooms, coaching, administration) were
not exercised on the live site. All migrations were applied to TiDB and its schema matches MySQL
(43 tables, 360 columns, 82 foreign keys).

### Formal test report

`reports/TuitionHub_Software_Test_Report.docx` and
[reports/test-results-summary.md](../reports/test-results-summary.md) (tested commit `c58399f`):
128 specified cases — 115 pass, 2 fail, 2 blocked, 9 not tested (98.3% of executed cases pass;
all 78 priority-1 cases pass); 59/59 manual API and security probes; core statement coverage 45.2%
(target 60%); three defects found and fixed (connection pool under load, session-bound access
tokens, blank names); evidence in `reports/evidence/`.

## Known limitations of the testing

- No CI pipeline: suites are run by hand.
- Statement coverage of the core packages is 45.2%; branch coverage is not measured.
- Browsers: desktop Chrome only (with mobile and tablet viewports); Safari, Firefox and real
  devices are not tested. No accessibility audit, Lighthouse run or load test on the live site.
- The full API suites have not been run against TiDB; only the live checks above and the schema
  comparison.
- Email delivery cannot be tested (no provider).
