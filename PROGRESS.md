# TuitionHub build-out progress

Checkpoint log for converting the prototype into a working platform. Branch:
`feature/verification-workflow` (never pushed).

## Status

| Phase | State | Evidence |
|---|---|---|
| 1 Audit | done | inventory below |
| 2 Migrations / schema | done | `cmd/migrate`, `003_platform.sql`; runner tested (baseline, idempotent, destructive guard) |
| 3 Tutor marketplace | done | Find tuition, apply/withdraw, saved posts, applications, profile + photo |
| 4 Parent marketplace | done | child links (student approves), tutor/centre search, posts, applicants, chat requests, demo class |
| 5 Classrooms | done | schedule, attendance (+absence alerts), homework/assignments, submissions with files, grading, materials, diary, progress |
| 6 Coaching | done | teachers, courses, branches, roster, batches (each with a classroom), enrolment, exams/results, fees, parents, reports |
| 7 Student | done | classrooms, submissions, grades, attendance, results, guardian approvals, tutor search |
| 8 Admin | done | overview, users (+detail, suspend), verification, tuition posts, matches, complaints/appeals/safety tickets, suspicious activity, reviews, payments, awards, reports/analytics (CSV), settings (enforced), announcements, audit log |
| 9 Messaging / notifications | done | persistent conversations, unread counts, read state, block, report; 4 s polling |
| 10 Security / sessions | partial | rate limits, token rotation + reuse detection, suspension, private files, object-level access. **Refresh token is still in localStorage** (see below) |
| 11 Regression | done | all suites green (below) |
| 12 Production readiness | partial | external services still required (below) |

All five roles' navigation items render real, backend-backed screens; no
screen uses sample data and no demo/prototype labels remain. The demo state
machine (`src/lib/{journey,parent,student,coaching,data,…}.ts`), the demo
controls drawer and the per-role demo pages were removed after their
replacements passed the browser tests.

## Tests (all against the isolated `tuitionhub_e2e` database)

| Suite | Checks |
|---|---|
| Go unit (`go test ./...`) | auth, rate limiter, image validation, workflow rules |
| Go integration (`-tags integration`) | lifecycle, integrity invariants, security controls; refuses non-`_e2e` DBs |
| `tests/verification-e2e.mjs` | 112 |
| `tests/platform-e2e.mjs` | 169 (all role journeys + permission boundaries) |
| `tests/browser-e2e.mjs` | 59 (verification UI, admin review, every screen at 3 widths) |
| `tests/journeys-browser.mjs` | 34 (link child → post → apply → chat → demo class → confirm → classroom → submit → grade → monitor; coaching operations) |

## Database

- `003_platform.sql` applied to `tuitionhub_e2e` and, after a full backup
  (`backend/backups/`, git-ignored), to the original `tuitionhub`. Only tables
  were added (11 → 42); the 3 existing users were verified unchanged; no admin
  was created there.
- Apply future migrations with `go run ./cmd/migrate` (records versions,
  refuses DROP/TRUNCATE/DELETE).

## Known gaps (honest list)

- **Session storage**: access and refresh tokens are in localStorage. Moving
  the refresh token to an httpOnly, SameSite cookie (and adding CSRF checks for
  the cookie endpoints) is the next security step.
- **Real-time**: messages and notifications poll (4 s in an open chat); no
  WebSocket push.
- **Coaching teachers** are roster records managed by the centre; they do not
  have their own logins.
- **Ranking** is the tutor's position by rating within each subject; there is
  no separate trust score.
- **Students** can post tuition through the API, but the student UI has no
  "post a tuition" screen (parents have one).
- Admin can view but not delete reviews; abusive reviews are handled through
  reports.

## External dependencies still required

- **Email** (verification and password-reset emails): no provider is
  configured. Development returns the token in the API response and the UI
  shows the link, labelled as a development fallback. Production needs an SMTP
  or API provider and credentials.
- **SMS / OTP**: not implemented; needs a Bangladesh SMS gateway account.
- **Payments**: TuitionHub records fees (due → marked paid → confirmed /
  disputed) but moves no money. A gateway (e.g. SSLCommerz / bKash) merchant
  account is needed to collect payments online.

## Next step

Move the refresh token to an httpOnly cookie with CSRF protection, then add
WebSocket push for messages, teacher logins for coaching centres, and a
student "post tuition" screen.
