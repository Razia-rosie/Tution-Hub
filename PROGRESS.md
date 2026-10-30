# TuitionHub — progress

Status as of **2026-10-31**. Detailed technical documentation:
`PROJECT_HANDOFF.md`. API/config/test commands: `backend/README.md`.

## Overview

Bangladesh-focused tutoring marketplace and tuition-management platform for
five roles (tutor, coaching centre, parent, student, admin). React 19 + Vite +
Tailwind v4 frontend (`src/`), Go 1.25 + Gin + sqlx backend (`backend/`),
MySQL 8 in Docker. Tutors and coaching centres are verified **manually** by an
admin from uploaded photos. Branch: `feature/verification-workflow`
(**never pushed**; `origin/main` is at `02714ca`).

## Where development stopped

The last completed task was **Phase 10, session security** (the latest commit on the
branch): refresh token in an httpOnly cookie, in-memory access token, CSRF
header guard, refresh-token reuse grace window. While testing it,
`REFRESH_REUSE_GRACE` was found declared but never loaded (fixed, covered by
`config_test.go`), and `/workflow/tuition` was fixed for posts without
requirements text. The working tree is clean apart from the local `.claude/`
preview configuration.

## Phase status

| Phase | State | Commit |
|---|---|---|
| Verification workflow (manual, picture-based) | done | cdbde01, 2f9b683, 7c98ca2 |
| Auth hardening (rate limits, suspension, rotation, timing) | done | 7c98ca2 |
| Admin: verification, users, audit log | done | 7c98ca2 |
| 1 Audit of demo features | done | — |
| 2 Migrations / schema (`cmd/migrate`, `003_platform.sql`) | done | 1082ad9 |
| 3 Tutor marketplace | done | 1082ad9 (API), cc2eb04 (UI) |
| 4 Parent marketplace (links, search, posts, chat requests, demo class) | done | 1082ad9, cc2eb04 |
| 5 Classrooms (schedule, attendance, homework, submissions, grading, materials, diary, progress) | done | 1082ad9, cc2eb04 |
| 6 Coaching management | done | 1082ad9, cc2eb04 |
| 7 Student experience | done | cc2eb04 |
| 8 Admin platform (posts, matches, tickets, reviews, payments, awards, reports, settings, announcements, suspicious activity) | done | 1082ad9, cc2eb04 |
| 9 Messaging and notifications (persistent, polling) | done | 1082ad9, cc2eb04 |
| 10 Session security (httpOnly cookie, CSRF guard, reuse grace) | done | latest commit ("Move browser sessions to an httpOnly refresh cookie") |
| 11 Regression testing | done for the current code (below) | — |
| 12 Production readiness | **not started** beyond docs (no deployment config, providers missing) | — |

Every navigation item of every role renders a backend-backed screen; the demo
layer (sample data, demo drawer, per-role demo pages) was removed in cc2eb04.

## Verified test results (latest commit, `tuitionhub_e2e`)

| Suite | Result |
|---|---|
| `go test ./...` (auth, config, ratelimit, workflow) | pass |
| `go test -tags integration ./internal/integration` | pass |
| `tests/verification-e2e.mjs` | 119 / 119 |
| `tests/platform-e2e.mjs` | 169 / 169 |
| `tests/browser-e2e.mjs` | 60 / 60 (incl. "no token readable by page scripts", every screen at 3 widths) |
| `tests/journeys-browser.mjs` | 34 / 34 (UI-driven cross-role journeys) |
| `npx tsc --noEmit -p .` and `pnpm build` | pass (main bundle 339 KB) |

## Remaining tasks (priority order)

1. Add the newer variables (`LOGIN_LIMIT_PER_ACCOUNT`, `LOGIN_LIMIT_PER_IP`,
   `SIGNUP_LIMIT_PER_IP`, `TRUSTED_PROXIES`, `REFRESH_REUSE_GRACE`) to
   `backend/.env.example`.
2. **Email provider** for verification and password-reset emails (currently
   only a development fallback that shows the link; production cannot reset
   passwords without it). Needs SMTP/API credentials from the owner.
3. **Production deployment setup**: build/serve the frontend, reverse proxy
   with HTTPS (`COOKIE_SECURE=true`, `TRUSTED_PROXIES`), process manager,
   `APP_ENV=production`, backups of MySQL and `DOCUMENT_DIR`.
4. **Pagination** for conversations, chat requests, classroom sessions,
   messages, results; and a foreign key for `tuition_listings.student_id`.
5. **Real-time push** (WebSocket or SSE) for messages and notifications
   (currently polling).
6. **Coaching teacher logins** (teachers are records today).
7. **Student "post a tuition" screen** (API exists; UI only for parents).
8. **SMS/OTP** (needs a Bangladesh SMS gateway) and **online payments**
   (needs a gateway merchant account; fees are tracking-only now).
9. Admin review moderation (hide/delete), shared rate-limit store for
   multi-instance deployments.

## Important file locations

- Role routing: `src/pages/RolePage.tsx`; navigation: `src/lib/nav.ts`
- Feature screens: `src/features/*.tsx`; admin pages: `src/pages/admin/*`
- API clients: `src/lib/api.ts` (auth/session), `src/lib/platform.ts` (everything else)
- Backend routes: `backend/internal/platform/routes.go`, `backend/internal/workflow/handler.go`, `backend/internal/auth/handler.go`
- Schema: `backend/migrations/00{1,2,3}_*.sql`; runner `backend/cmd/migrate`
- Tests: `tests/*.mjs`, `tests/lib/browser.mjs`, `backend/internal/**/_test.go`
- Database backup (git-ignored): `backend/backups/tuitionhub-20261031-010242.sql`

## Known issues

See `PROJECT_HANDOFF.md` §8. Highlights: no email/SMS/payment providers;
polling instead of push; in-memory rate limits; two polymorphic or
FK-less columns; local-disk file storage without scanning; no deployment config.

## Database safety

Original `tuitionhub`: 3 pre-existing users unchanged, no admin, migrations
001–003 applied additively after a full backup. All destructive testing uses
`tuitionhub_e2e` (has its own test admin `e2e-admin@tuitionhub.test`).
