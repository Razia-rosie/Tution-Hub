# TuitionHub — technical handoff

Written 2026-10-31 from the code, database and Git state at that time (not
from conversation memory). Read with `PROGRESS.md` (status and priorities); full
documentation is in `docs/` (index: `docs/README.md`).

## 1. What TuitionHub is

A Bangladesh-focused tutoring marketplace and tuition-management platform with
five roles: **private tutor**, **coaching centre**, **parent/guardian**,
**student**, **admin**. Tutors and coaching centres are verified **manually**
by an admin from uploaded document photos (no OCR/AI/auto-approval — this is a
hard requirement from the owner). After verification, families find tutors or
post tuition needs, chat, book a demo class, confirm terms, and the tutor runs
a classroom (schedule, attendance, homework, materials, diary, grades).
Coaching centres manage teachers, students, batches, exams and fees.

## 2. Stack and layout

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, TypeScript 5.7, Tailwind CSS v4, react-router 8, lucide-react. Scaffolded by Figma Make (`AGENTS.md`, `.figma/`) |
| Backend | Go 1.25, Gin, sqlx, go-sql-driver/mysql, golang-jwt v5, bcrypt, golang.org/x/image (WebP decode) |
| Database | MySQL 8 (Docker, `backend/docker-compose.yml`), phpMyAdmin on :8081 |
| Tests | Go `testing` + go-sqlmock; Node scripts with `fetch`; puppeteer-core driving local Google Chrome |

```
src/
  main.tsx, App.tsx, routes.tsx      router (public, auth, /app/:role/:page/*)
  lib/api.ts                         auth client, token/session handling, generic `api` helper, verification/admin calls
  lib/platform.ts                    typed client for every platform endpoint
  lib/store.tsx                      React context: session, signup draft, verification banner, toasts (no domain data)
  lib/useLoad.ts                     useLoad (loading/error/stale-guard) and useAction (busy + toasts)
  lib/nav.ts                         per-role navigation (source of truth for menu items)
  components/AppShell.tsx            signed-in shell: sidebar, header bell + unread badge, verification banner, role guard
  components/RealVerification.tsx    tutor/coaching verification form (picture slots, submit, status panel)
  components/RealNotifications.tsx   notifications page (all roles)
  components/ui.tsx                  design-system primitives (Button, Field, Modal, Tabs, StatusChip, …)
  features/                          role screens: Marketplace, Messages, Tuitions, Classrooms, People, Coaching, common
  pages/RolePage.tsx                 maps every role nav slug to a feature screen (lazy-loaded)
  pages/admin/                       Overview, Users, Verification, Audit, Platform (posts, matches, tickets, reviews, payments, awards, reports, settings)
  pages/auth/                        Login, Signup, Recovery (forgot/reset/recover/logout/gate/admin login)
  pages/public/                      Search (tutors, tuition, coaching), Info, Faq, Contact; Landing.tsx
backend/
  cmd/server                         API entrypoint (router, trusted proxies, route registration)
  cmd/migrate                        forward-only migration runner (schema_migrations, baseline, destructive guard)
  cmd/bootstrap-admin                creates the first admin (refuses if one exists)
  internal/config                    env configuration (+ tests)
  internal/auth                      register/login/refresh/logout/me, reset, email verify, RequireAuth/OptionalAuth, rate limits, cookie sessions
  internal/ratelimit                 in-memory fixed-window limiter
  internal/workflow                  verification (documents, submit, admin review, interviews), dashboard/profile, notifications, admin users/stats/audit
  internal/platform                  marketplace, links, chat, conversations, engagements, payments, reviews, classrooms, coaching, support, admin platform
  internal/integration               integration tests (build tag `integration`, refuse non-_e2e DBs)
  migrations/001_auth.sql, 002_workflows.sql, 003_platform.sql
tests/
  verification-e2e.mjs, platform-e2e.mjs        API end-to-end
  browser-e2e.mjs, journeys-browser.mjs          browser end-to-end (puppeteer-core + Chrome)
  lib/browser.mjs                                shared browser helpers
  fixtures/                                      real JPEG/PNG/WebP images
  legacy/                                        obsolete prototype scripts (do not run)
```

## 3. Authentication and authorization

- Passwords: bcrypt. Unknown-email logins compare against a dummy hash (no timing leak).
- Access token: HS256 JWT, 15 min (`ACCESS_TOKEN_TTL`).
- Refresh token: random 32 bytes, stored as SHA-256 hash in `refresh_tokens`, 30 days, **rotated on every use**.
  - Browser sessions send `X-Session-Mode: cookie`: the refresh token is set as cookie `th_refresh`
    (`HttpOnly; SameSite=Strict; Path=/api/v1/auth`, `Secure` when `COOKIE_SECURE=true`) and is blank in the JSON body.
    The access token is held **only in memory** (`accessToken` in `src/lib/api.ts`); `localStorage['tuitionhub.session']='1'`
    only signals that a silent refresh should be attempted on reload. Old `tuitionhub.access_token/refresh_token` keys are migrated once and deleted.
  - Cookie refresh/logout require the `X-Session-Mode` header (CSRF guard). Non-browser clients may pass `refresh_token` in the body.
  - Reuse of a rotated token within `REFRESH_REUSE_GRACE` (default 20 s) gets a fresh session (navigation/multi-tab race);
    after that it is treated as theft and **all** of the user's sessions are revoked. Logout, suspension and password reset
    also set `expires_at = now` so the grace window cannot revive those tokens.
- `RequireAuth` loads `role` and `account_status` from the DB on **every** request (suspension is immediate) and puts
  `user_id`, `role`, `account_status` in the Gin context. `OptionalAuth` does the same for public routes when a token is sent.
- Rate limits (`internal/ratelimit`, per process): failed logins 5 per email+IP / 15 min, 50 per IP / 15 min (429 + Retry-After);
  register/forgot/reset/verify-email 20 per IP / hour; public contact 10 per IP / hour. `X-Forwarded-For` is trusted only from `TRUSTED_PROXIES`.
- Admin accounts cannot self-register; the first admin comes from `cmd/bootstrap-admin`.
- Object-level access (platform): classroom access levels owner / member / viewer (approved guardian of a member) / admin
  (`classroomAccess` in `classrooms.go`); conversations require participation (404 otherwise); guardians see a student only
  through an **approved** `guardian_student_links` row (the student approves); every coaching query is scoped by `coaching_id = caller`;
  verification documents only to owner or admin (others get 404).

## 4. Database (MySQL, 42 tables incl. `schema_migrations`)

Migrations are **additive only** and applied with `go run ./cmd/migrate` (from `backend/`). Both `tuitionhub` (original, real data)
and `tuitionhub_e2e` (tests) have 001, 002, 003 recorded. A full backup of the original taken before 003 is in
`backend/backups/tuitionhub-20261031-010242.sql` (git-ignored, contains password hashes).

| Area | Tables (key constraints) |
|---|---|
| Accounts | `users` (role enum incl. admin, `account_status` enum pending/resubmission_required/interview_*/approved/profile_incomplete/active/rejected/suspended), `refresh_tokens`, `auth_tokens`, `role_profiles` (1:1 user; JSON subjects/classes/areas/mediums/teaching_modes/availability; bio, photo_key, listed, …) |
| Verification | `verification_applications` (UNIQUE user_id; status draft/pending/under_review/resubmission_required/approved/rejected), `verification_documents` (UNIQUE application+type, sha256), `interviews` |
| Social | `guardian_student_links` (UNIQUE guardian+student; pending/approved/rejected/revoked), `connection_requests` (chat requests), `conversations`, `conversation_participants` (last_read_at), `messages`, `user_blocks`, `notifications`, `audit_logs` |
| Marketplace | `tuition_listings` (status open/paused/filled/closed; `student_id` has **no FK**), `tuition_applications` (UNIQUE listing+tutor), `saved_listings` |
| Tuition | `engagements` (status trial_requested/trial_scheduled/trial_declined/proposed/active/completed/cancelled; two confirmation timestamps), `payment_records` (UNIQUE engagement+month), `reviews` (UNIQUE engagement+reviewer, CHECK stars 1–5), `awards` |
| Classroom | `classrooms` (UNIQUE engagement_id), `classroom_members` (student users), `classroom_materials`, `assignments`, `submissions` (UNIQUE assignment+student), `class_sessions`, `attendance_marks` (learner_kind user/roster — **polymorphic, no FK on learner_id**), `diary_entries` (UNIQUE classroom+date) |
| Coaching | `coaching_branches`, `coaching_teachers`, `coaching_courses`, `coaching_students` (roster; optional user_id / guardian_user_id), `coaching_batches` (each has a classroom), `batch_enrollments`, `exams`, `exam_marks`, `coaching_fees` (UNIQUE student+month) |
| Platform | `support_tickets` (categories support/complaint/report_user/report_post/safety/payment/appeal; reporter nullable for anonymous contact), `platform_settings` (typed whitelist in `settingDefaults`) |

Deleting a user cascades to most owned rows; authored content keeps rows with `SET NULL`. `interviews.scheduled_by` is `NO ACTION` (deleting an admin who scheduled interviews will fail).

## 5. API (all under `/api/v1`; ~134 routes)

Auth `/auth`: register, login, refresh, logout, me, forgot-password, reset-password, verify-email/request, verify-email.

Workflow `/workflow` (auth): dashboard, profile (PUT), verification/documents (POST upload, GET :id), verification/submit,
notifications, notifications/read, relationships (legacy), tuition (legacy listing). Admin `/workflow/admin`: verifications
(list, :id/documents, :id/history, :id/decision, :id/interviews, :id/interviews/:iid/outcome), stats, users, users/:id/suspend|reactivate, audit-logs.

Platform (see `internal/platform/routes.go`):
- Public (`/public`, optional auth): tutors, tutors/:id, coaching, coaching/:id, tuition, tuition/:id, info, contact (POST), users/:id/photo.
- Profile/users: profile/photo, users/:id/awards, users/:id/block (POST/DELETE), users/:id/reviews, reviews/:id/reply.
- Marketplace: tuition-posts (GET search, POST create, mine, :id PUT, :id/status, :id/apply, :id/applications, :id/save POST/DELETE), applications/mine, applications/:id/status.
- Links/progress: links (GET/POST), links/:id/respond, students/:id/progress, results.
- Chat: chat-requests (GET/POST), chat-requests/:id/accept|decline|cancel, conversations, conversations/unread, conversations/:id/messages (GET ?after= / POST), conversations/:id/read.
- Tuitions: engagements (GET/POST), engagements/:id/actions (accept_trial, decline_trial, propose, confirm, cancel, complete), engagements/:id/payments (GET/POST due|mark_paid|confirm|dispute), engagements/:id/review.
- Classrooms: classrooms (GET/POST), classrooms/:id, :id/members (POST, DELETE /:student), :id/materials, materials/:id/file, :id/assignments, assignments/:id/submit, assignments/:id/submissions, submissions/:id/review, submissions/:id/file, :id/sessions, sessions/:id/status, sessions/:id/attendance, :id/diary.
- Coaching (`/coaching`, coaching role): teachers, courses, branches, students (GET/POST/PUT), batches (GET/POST/PUT, :id/learners, :id/enrollments/:student POST/DELETE), exams (GET/POST, :id/marks GET/POST), fees (GET, generate, :id/paid|waive|remind), report.
- Support: support-tickets (POST), support-tickets/mine.
- Admin (`/admin`): tickets (GET, POST :id), tuition-posts (GET, :id/status), settings (GET/PUT), announcements, awards, users/:id, reports, engagements, reviews, payments, suspicious.

All of the above are implemented and exercised by the API suites, except: `/workflow/relationships` and `/workflow/tuition` are
older endpoints superseded by `/links` and `/tuition-posts` (still covered by tests, not used by the UI).

## 6. Key business rules

- **Verification**: tutor needs `identity` picture (+ optional `education`); coaching needs `trade_license` + `owner_identity`.
  First upload creates a `draft`; submit requires required pictures + 100 % profile (422 lists what is missing). From
  submission the pictures and reviewed profile fields are locked until `resubmission_required`. Rejection is final.
  Approval with a complete profile → account `active`. Images are sniffed and fully decoded (JPEG/PNG/WebP, ≤10 MB,
  ≤40 MP). Admin views of documents are audited.
- Students and parents start `active` and cannot enter verification.
- **Applications**: tutor (active) applies → poster shortlists/declines/accepts; accept opens a conversation. Tutor may withdraw before acceptance. Settings `tutor_applications_open` and `max_applications_per_day` are enforced.
- **Chat requests**: only parent/student → verified tutor/coaching; one pending per pair; accept opens a conversation.
- **Engagement state machine** (`social.go` `ActOnEngagement`): requires an existing conversation; demo class optional;
  proposing terms resets the other side's confirmation; when both confirm → `active`, classroom created with the student,
  post marked filled, contact details (email/phone) shared. Payments are tracking only.
- **Classrooms**: owner manages; attendance on a non-member is rejected; absences notify approved guardians; reviewed submissions are locked; scores bounded by max.
- **Coaching**: capacity enforced; published exam marks are locked; fee generation is idempotent per month; reminders need a linked guardian account.

## 7. Configuration

`backend/.env.example` lists every backend variable (see `docs/setup.md`). Vite: `API_PROXY_TARGET`
(default `http://localhost:8080`), `PORT`.

## 8. Known issues, debt and risks (verified against code)

- Email/SMS/payment providers are not integrated (see PROGRESS.md). Development returns reset/verification tokens in API responses (disabled when `APP_ENV=production`).
- Real-time is polling (4 s in an open chat, 12 s list refresh, unread badge only on load and when notifications change).
- Rate limiting is in-memory per process (resets on restart; not shared across instances).
- `tuition_listings.student_id` and `attendance_marks.learner_id` have no foreign keys (integrity enforced in code only).
- `interviews.scheduled_by` FK is `NO ACTION`.
- Uploaded files are on local disk (`DOCUMENT_DIR`, `DOCUMENT_DIR/files`); no virus scanning; no off-site storage/backup.
- `RequireAuth` does a DB lookup per request (acceptable now; consider caching at scale).
- No pagination on several lists: conversations (uncapped), chat requests (200), classroom sessions (200), messages (500 per fetch), results (200), diary (100).
- Coaching teachers are records, not user accounts; students cannot post tuition from the UI; admin cannot delete reviews.
- The dev frontend runs on Vite's dev server; no production deployment configuration (reverse proxy, HTTPS, process manager) exists yet.

## 9. Testing

Run against the isolated `tuitionhub_e2e` database only. Test admin: `e2e-admin@tuitionhub.test` (password is in the
previous session's scratchpad; if lost, it cannot be re-bootstrapped because an admin exists — reset it via
`/auth/forgot-password` on a development server, which returns the token).

```sh
# from backend/
go test ./...
E2E_DATABASE_URL='tuitionhub:tuitionhub@tcp(127.0.0.1:3306)/tuitionhub_e2e?parseTime=true&charset=utf8mb4&loc=UTC' \
  E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... go test -tags integration ./internal/integration
# test API on :8090
DATABASE_URL='...tuitionhub_e2e...' JWT_SECRET=<32+ chars> HTTP_ADDR=:8090 DOCUMENT_DIR=/tmp/e2e-docs \
  SIGNUP_LIMIT_PER_IP=1000 REFRESH_REUSE_GRACE=2s go run ./cmd/server
# from the repository root
API_PROXY_TARGET=http://localhost:8090 PORT=5174 pnpm dev        # test frontend
export E2E_API=http://localhost:8090 E2E_WEB=http://127.0.0.1:5174 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=...
node tests/verification-e2e.mjs && node tests/platform-e2e.mjs && node tests/browser-e2e.mjs && node tests/journeys-browser.mjs
npx tsc --noEmit -p . && pnpm build
```

## 10. Decisions to respect

- Never modify or reset the original `tuitionhub` database; destructive tests only on `tuitionhub_e2e`; additive migrations with a backup first.
- Verification stays manual and picture-only (JPG/PNG/WebP); admin is the only decision-maker.
- Do not remove existing features or hide nav items; no demo/sample data in production screens.
- Do not push or open PRs without the owner's explicit permission. Commit only when asked.
- Keep the existing stack (React/Vite/Tailwind + Go/Gin/sqlx + MySQL).
