# TuitionHub

A tutoring marketplace and tuition-management platform for Bangladesh. Guardians and
students find **manually verified** private tutors and coaching centres, agree on a
tuition after a demo class, and then follow the teaching in one place: schedule,
attendance, homework, grades, study materials and a daily class diary. Coaching
centres run their teachers, students, batches, exams and fees on the same platform,
and administrators review every tutor and centre by hand before they are listed.

**Stack:** React 19 + Vite 8 + TypeScript + Tailwind CSS 4 (frontend) · Go 1.25 +
Gin + sqlx REST API (backend) · MySQL 8 (Docker for local development).

> Status: feature-complete for local development and covered by automated tests.
> It is **not deployed**, and email, SMS and online-payment providers are not yet
> integrated. See [PROGRESS.md](PROGRESS.md) and [docs/known-issues.md](docs/known-issues.md).

## Documentation

| Document | What it covers |
|---|---|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/setup.md](docs/setup.md) | Local development setup, environment variables, migrations |
| [docs/architecture.md](docs/architecture.md) | How the frontend, API and database fit together; repository layout |
| [docs/api.md](docs/api.md) | REST API reference with access rules |
| [docs/database.md](docs/database.md) | Tables, relationships, constraints and migrations |
| [docs/workflows.md](docs/workflows.md) | Verification, hiring, classroom and coaching workflows step by step |
| [docs/security.md](docs/security.md) | Authentication, sessions, access control, uploads, rate limiting |
| [docs/testing.md](docs/testing.md) | Unit, integration, API and browser test suites |
| [docs/deployment.md](docs/deployment.md) | What a production deployment needs (not yet done) |
| [docs/deployment-free.md](docs/deployment-free.md) | $0 deployment plan: Vercel Hobby + TiDB Cloud Starter |
| [docs/known-issues.md](docs/known-issues.md) | Open gaps and technical debt |
| [PROGRESS.md](PROGRESS.md) | Phase status, verified test results, prioritised remaining work |
| [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md) | Condensed technical handoff for continuing development |
| [CHANGELOG.md](CHANGELOG.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) | History, conventions, vulnerability reporting |

## Features

- **Manual, picture-based verification** for tutors (ID, optional education certificate)
  and coaching centres (trade licence and owner ID). An administrator approves, rejects
  with a reason, or requests corrections; there is no automated document checking.
- **Discovery**: public search of verified tutors and coaching centres by subject, class,
  area, mode and fee; public tuition posts.
- **Hiring**: tuition posts with applications (shortlist, decline, accept), chat requests,
  persistent messaging with unread counts, blocking and reporting, demo-class requests,
  and two-sided confirmation of terms. Contact details are shared only after both sides confirm.
- **Classrooms**: weekly schedules, attendance with absence alerts to guardians,
  homework and assignments with file submissions, grading and feedback, study materials
  (pictures or PDF), a daily diary and progress summaries.
- **Guardian links**: a parent links a child's student account and the child approves;
  parents then see only their own children's classes.
- **Coaching management**: branches, teachers, courses, student roster, batches (each with
  its own classroom), capacity-checked enrolment, exams with publish-locked results,
  monthly fee tracking with reminders, and operational reports.
- **Fee tracking and reviews**: monthly fee records (due, marked paid, confirmed,
  disputed) and reviews from families with a confirmed tuition. TuitionHub does not move money.
- **Administration**: statistics, user management with suspension, the verification queue
  with document preview and history, tuition-post moderation, support and complaint
  tickets, suspicious-activity list, reviews, payments, awards, period reports with CSV
  export, platform settings, announcements and an audit log.
- **Notifications** for every important event, with read state and an unread badge.

## User roles

| Role | Can |
|---|---|
| Private tutor | Get verified, build a profile, apply to tuition posts, chat, run classrooms, track fees, reply to reviews |
| Coaching centre | Get verified, manage teachers, courses, branches, students, batches, exams and fees |
| Parent / guardian | Link children, post tuition, search and contact tutors, book demo classes, confirm tuitions, monitor progress |
| Student | Approve guardians, join classrooms, submit homework, see grades, attendance and results |
| Admin | Review verifications and run the platform (no public registration; created with a CLI) |

## Architecture

```
Browser (React SPA, Vite)
   │  /api/*  (Vite dev proxy → :8080)
   ▼
Go API (Gin)  ── auth · workflow (verification) · platform (marketplace, messaging,
   │              classrooms, coaching, admin) · ratelimit · config
   ▼
MySQL 8  +  private file storage on disk (DOCUMENT_DIR)
```

Details: [docs/architecture.md](docs/architecture.md).

## Repository structure

```
src/                 React frontend (pages, feature screens, API clients, UI kit)
backend/
  cmd/server         API entrypoint
  cmd/migrate        forward-only migration runner
  cmd/bootstrap-admin  creates the first administrator
  internal/          auth, workflow, platform, ratelimit, config, database, integration tests
  migrations/        001_auth.sql, 002_workflows.sql, 003_platform.sql
tests/               API and browser end-to-end suites, fixtures (tests/legacy is obsolete)
docs/                project documentation
Makefile             development stack commands
```

## Quick start

**Prerequisites:** Docker Desktop, Go 1.25 (`backend/go.mod`), Node.js 22 and pnpm 10
(pinned in `.mise.toml`), and Google Chrome for the browser tests.

```sh
pnpm install
make up        # MySQL + phpMyAdmin (Docker), Go API with hot reload, Vite dev server
make status    # show the API and frontend processes
make down      # stop everything
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:8080 (`/health`) |
| phpMyAdmin | http://localhost:8081 (local Docker credentials in `backend/docker-compose.yml`) |

A fresh MySQL volume applies every migration automatically. For an existing database,
back it up and run `go run ./cmd/migrate` from `backend/`. Create the first administrator
with `go run ./cmd/bootstrap-admin` (see [docs/setup.md](docs/setup.md)).

`make up` runs the API with development defaults. To configure it yourself, copy
`backend/.env.example` and export the variables; production must use its own
`DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters.

## Authentication and verification in short

- Passwords are hashed with bcrypt. Sign-in issues a 15-minute JWT access token and a
  rotating refresh token. In the browser the refresh token lives in an `HttpOnly`,
  `SameSite=Strict` cookie and the access token only in memory.
- Every authenticated request re-checks the account in the database, so suspension takes
  effect immediately. Login, registration and contact forms are rate limited.
- Tutors and coaching centres upload real JPEG, PNG or WebP pictures (≤ 10 MB, fully
  decoded server-side). Pictures are stored outside the web root and are visible only to
  their owner and administrators; every administrator view is audited.

More: [docs/security.md](docs/security.md) and [docs/workflows.md](docs/workflows.md).

## Testing

```sh
cd backend && go test ./...                 # unit tests
npx tsc --noEmit -p . && pnpm build         # type-check and production build
```

The integration, API and browser suites run against a separate `tuitionhub_e2e` database
and a second API instance; [docs/testing.md](docs/testing.md) has the exact commands.

## Deployment

Not deployed yet. A production setup needs HTTPS, a reverse proxy, a managed MySQL
database, persistent storage for uploads, an email provider and secrets management;
see [docs/deployment.md](docs/deployment.md).

## Known limitations

No email, SMS or payment-gateway integration; messages and notifications use polling
rather than push; rate limits are in memory per process. Full list:
[docs/known-issues.md](docs/known-issues.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues privately as described in
[SECURITY.md](SECURITY.md).
