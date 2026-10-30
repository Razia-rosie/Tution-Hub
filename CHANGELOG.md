# Changelog

All notable changes to TuitionHub. Dates are 2026; commit hashes refer to this repository.

## Unreleased

### Added
- Development-only demo-account seed (`scripts/seed-demo.mjs`) and checks
  (`tests/demo-accounts.mjs`); passwords stay in git-ignored local files ([docs/demo-accounts.md](docs/demo-accounts.md)).
- `make backend-dev` reads local overrides from the git-ignored `backend/.env.local`.
- Project documentation: README, `docs/` (architecture, setup, API, database, workflows,
  security, testing, deployment, known issues), CONTRIBUTING and SECURITY policies.

### Fixed
- `backend/.env.example` is now tracked (the `.env*` ignore rule had excluded it) and lists the
  rate-limit, trusted-proxy and refresh-grace settings. `.claude/` local tool configuration is
  ignored. (`e2c3cbb`)

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
