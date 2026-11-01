# Changelog

All notable changes to TuitionHub. Dates are 2026; commit hashes refer to this repository.

## Unreleased

### Docs
- Repository documentation reorganised: new README with live links, screenshots and verified test
  results; `docs/` renamed to PROJECT_OVERVIEW, FEATURES (with verification levels), ARCHITECTURE,
  DATABASE (ER diagram), LOCAL_SETUP, DEPLOYMENT, TESTING, SECURITY, USER_GUIDE, ADMIN_GUIDE,
  API_DOCUMENTATION, KNOWN_ISSUES, DEMO_ACCOUNTS; real screenshots in `docs/screenshots/`; the
  31 Oct handoff notes moved to `docs/history/`; this changelog moved to `docs/`.
- Root `.env.example` for the website build variables.

### Fixed
- `tests/demo-accounts.mjs` no longer fails in the month after seeding (fees are checked for the
  current and previous month).

## 1 Nov — Live on Vercel + TiDB (`244f28f`, `19f6b8b`, `e0cf5b9`, `463d181`)

### Added
- Deployed at https://tuitionhub-omega.vercel.app on Vercel Hobby (website and Go API as two
  Services on one origin) with TiDB Cloud Starter in Singapore, for $0 per month.
- `internal/filestore`: uploads stored on disk (default) or in the new `stored_files` table
  (migration `005`, `FILE_STORAGE=database`).
- Configurable upload limit (`MAX_UPLOAD_MB`, `VITE_MAX_UPLOAD_MB`), client IP from a platform
  header (`CLIENT_IP_HEADER`), and listening on `PORT`.
- `vercel.json` and the free-hosting deployment guide.

### Fixed
- The migration runner executes the `SELECT ... INTO @var` guards as `SET @var = (SELECT ...)`, so
  all migrations apply on TiDB (`e0cf5b9`).
- The browser tab shows "TuitionHub" instead of the scaffold default (`463d181`).

## 31 Oct — Defects from the Software Test Report (`01cd277`, `b0536fa`, `c58399f`, `b85e839`)

### Fixed
- The API configures its MySQL connection pool (`DB_MAX_OPEN_CONNS`, `DB_MAX_IDLE_CONNS`,
  `DB_CONN_MAX_LIFETIME`; defaults 25 / 25 / 5m). Under concurrent load about 30% of public search
  requests had returned HTTP 500 (DEF-01).
- Access tokens are bound to a session (`sid` claim, migration `004`), so logout, password reset and
  suspension reject them immediately (DEF-02).
- Registration trims the name before validation, so blank names are refused (DEF-03).

### Docs
- Software Test Report and evidence in `reports/`.

## 31 Oct — Demo accounts and tooling (`5be94ce`, `efc0eda`, `8255aff`)

### Added
- Development-only demo-account seed (`scripts/seed-demo.mjs`) and checks
  (`tests/demo-accounts.mjs`); demo credentials published in [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md).
- `make backend-dev` reads overrides from the git-ignored `backend/.env.local`; `make down` stops
  the whole process tree.

## 31 Oct — Repository documentation (`e2c3cbb`, `6bad3a8`)

### Added
- README, `docs/`, CONTRIBUTING and SECURITY; `backend/.env.example` is tracked.

## 31 Oct — Session security (`245f668`)

### Security
- Browser sessions keep the refresh token in an `HttpOnly`, `SameSite=Strict` cookie and the
  access token only in memory; legacy localStorage tokens are migrated once and deleted.
- Cookie refresh/logout require the `X-Session-Mode` header (CSRF guard).
- Rotated refresh tokens may be reused within `REFRESH_REUSE_GRACE` (navigation and multi-tab
  races); later reuse revokes every session. Logout, suspension and password reset expire tokens.

### Fixed
- `REFRESH_REUSE_GRACE` was declared but never loaded; configuration tests added.
- `/workflow/tuition` failed on posts without requirements text.
- Signed-out forms (forgot password, contact, account recovery) no longer require a session.

### Docs
- `PROGRESS.md` updated; `PROJECT_HANDOFF.md` added.

## 31 Oct — Real screens for every role (`cc2eb04`)

### Added
- Backend-backed screens for all five roles: marketplace, messaging, tuition agreements,
  classrooms, profiles, children, progress and results, reviews, ranking, awards, support,
  dashboards and coaching management; full admin menu; real public search pages.
- Password reset and account recovery call the API; the contact form files a support ticket.

### Removed
- The prototype layer: sample data modules, demo drawer, per-role demo pages, screen inventory.

### Changed
- Landing, about, safety, FAQ and footer copy describe only implemented behaviour.
- Feature modules are lazy-loaded (main bundle 1.09 MB → 339 KB).

## 31 Oct — Platform backend (`1082ad9`)

### Added
- `cmd/migrate` forward-only migration runner and additive `003_platform.sql`.
- Public discovery, tuition posts and applications, guardian links with student consent, chat
  requests, persistent conversations, demo class and two-sided tuition agreements, payment
  tracking, reviews, classrooms (materials, assignments, submissions, grading, sessions,
  attendance, diary, progress), coaching management, support tickets and admin platform tools.
- `tests/platform-e2e.mjs` covering the role journeys and permission boundaries.

## 31 Oct — Verification and auth hardening (`7c98ca2`)

### Security
- Login rate limiting, constant-time unknown-email login, atomic refresh rotation with reuse
  detection, immediate suspension, trusted-proxy handling.
- Uploads fully decoded as images with size and pixel limits; document responses `no-store`,
  `nosniff`, sandboxed.

### Added
- Draft applications, required pictures per role, locked evidence during review, application
  history, admin overview, user management with suspension, audit-log viewer, real notifications.
- Go integration tests, API and browser end-to-end suites.

## 30 Oct — Verification workflow (`cdbde01`, `2f9b683`)

### Added
- Verification API (documents, submission, admin decisions, interviews), admin review UI,
  administrator bootstrap CLI, workflow migration `002`.

### Fixed
- Issues found by the first end-to-end tests (coaching verification reached no backend,
  profile prefill, admin page details).

## Earlier — Frontend authentication (`02714ca`)

- Frontend sign-up and sign-in wired to the Go authentication API.
