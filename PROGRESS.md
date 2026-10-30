# TuitionHub build-out progress

Checkpoint log for converting every demo feature into real, database-backed
functionality. Updated at each commit. Branch: `feature/verification-workflow`
(never pushed).

## Status by phase

| Phase | Backend + DB | API tests | Frontend wired | Notes |
|---|---|---|---|---|
| 1 Audit | done | — | — | inventory below |
| 2 Migrations / schema | done | runner tested (baseline, idempotent, destructive guard) | — | `003_platform.sql`, `cmd/migrate` |
| 3 Tutor marketplace | done | `platform-e2e` | **pending** | posts, search, apply, withdraw, shortlist/accept, saved |
| 4 Parent marketplace | done | `platform-e2e` | **pending** | links with student consent, discovery, chat requests, demo class |
| 5 Classrooms | done | `platform-e2e` | **pending** | materials (PDF/images), assignments, submissions, grading, sessions, attendance, diary, progress |
| 6 Coaching | done | `platform-e2e` | **pending** | branches, teachers, courses, roster, batches (+classroom), enrolment, exams/results, fees, report |
| 7 Student | done (shared with 5) | `platform-e2e` | **pending** | |
| 8 Admin platform | done | `platform-e2e` | partial (verification, users, audit done earlier) | tickets, tuition posts, settings, announcements, awards, reports, suspicious activity |
| 9 Messaging / notifications | done (polling) | `platform-e2e` | notifications done; messaging **pending** | |
| 10 Security / sessions | partial | integration tests | — | httpOnly refresh cookie **pending** |
| 11 Regression | API suites green | 164 + 112 checks | browser suite to extend | |
| 12 Production readiness | — | — | — | |

## Feature inventory (Phase 1)

Every role screen except verification, notifications and the admin pages was a
client-side demo driven by `src/lib/{journey,parent,student,coaching}.ts`
sample data, labelled in the app with "Preview with sample data". Each is
being rewired to the endpoints below; the notice is removed from a screen only
when that screen uses real data.

| Screen (route) | Demo source | Real endpoints |
|---|---|---|
| Tutor › Find Tuition | `POSTS`, `matchPost` | `GET /tuition-posts`, `POST /tuition-posts/:id/apply`, save |
| Tutor › My Posts (applications) | `journey.interests` | `GET /applications/mine`, `POST /applications/:id/status` |
| Tutor › Messages / requests | `journey.chat`, `REQUESTS` | `/chat-requests`, `/conversations` |
| Tutor › My Students, Schedule, Attendance, Homework, Assignments, Progress | `journey.*` | `/classrooms`, `/sessions`, `/assignments`, `/submissions` |
| Tutor › Reviews, Ranking, Awards, Payments | `OLD_REVIEWS`, `journey.pay` | `/users/:id/reviews`, `/reviews/:id/reply`, `/users/:id/awards`, `/engagements/:id/payments` |
| Tutor › Profile | `journey.profile` | `PUT /workflow/profile`, `POST /profile/photo` |
| Parent › Children | `pj.kids`, `DIRECTORY` | `/links` |
| Parent › Find Tutor, My Posts, Active Tuitions | `TUTORS`, `pj.posts` | `/public/tutors`, `/tuition-posts`, `/engagements` |
| Parent › Schedule, Attendance, Homework, Progress | `pj.*` | `/classrooms`, `/students/:id/progress` |
| Parent › Messages, Payments | `pj.*` | `/conversations`, `/engagements/:id/payments` |
| Student › all | `sj.*` | `/classrooms`, `/assignments/:id/submit`, `/results`, `/links` |
| Coaching › all | `cj.*` | `/coaching/*`, `/classrooms`, `/sessions` |
| Admin › Tuition posts, Reports, Complaints, Settings, … | — | `/admin/*` |
| Public › Find tutor / tuition / coaching | `TUTORS`, `POSTS`, `CENTRES` | `/public/*` |

## Database

- `003_platform.sql` applied to `tuitionhub_e2e` and, after a full backup
  (`backend/backups/`, git-ignored), to the original `tuitionhub`. Only tables
  were added (11 → 42); the 3 existing users were verified unchanged; no admin
  was created there.
- Apply future migrations with `go run ./cmd/migrate` (records versions,
  refuses DROP/TRUNCATE/DELETE).

## External dependencies still required

- Email delivery (verification and password-reset emails): no provider is
  configured; development returns tokens in the API response. Needs an SMTP or
  API provider and credentials.
- SMS / OTP: not implemented; needs a Bangladesh SMS gateway account.
- Payments: TuitionHub only tracks fees (due → marked paid → confirmed /
  disputed). Moving money needs a gateway (e.g. SSLCommerz / bKash) merchant
  account.

## Next step

Wire the frontend screens to the endpoints above, role by role, starting with
the tutor area, then parent, student, coaching and admin; extend the browser
suite per role; then move the refresh token to an httpOnly cookie.
