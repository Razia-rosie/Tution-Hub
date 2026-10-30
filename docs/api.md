# API reference

Base path: `/api/v1`. JSON in and out unless noted. Errors are `{"error": "..."}` with a
meaningful status (400 validation, 401 unauthenticated, 403 forbidden, 404 not found or not
yours, 409 invalid state transition, 422 incomplete verification, 429 rate limited).

**Access levels:** *public* (no token), *optional* (public, personalised when signed in),
*auth* (any signed-in, non-suspended account), plus role or ownership checks as listed.
Authenticated requests send `Authorization: Bearer <access token>`.

Route registration: `backend/internal/auth/handler.go`, `backend/internal/workflow/handler.go`,
`backend/internal/platform/routes.go`. All endpoints below are implemented and exercised by the
API test suites ([testing.md](testing.md)).

## Health

| Method | Path | Access |
|---|---|---|
| GET | `/health` (no `/api/v1` prefix) | public |

## Auth — `/auth`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/register` | public, rate limited | `name, email, password, role` (tutor, student, parent, coaching). Tutors/coaching start `pending`, others `active` |
| POST | `/login` | public, rate limited | Failed attempts limited per account+IP and per IP |
| POST | `/refresh` | public | Body `refresh_token`, or cookie `th_refresh` with header `X-Session-Mode: cookie` |
| POST | `/logout` | public | Revokes the refresh token (body or cookie) |
| GET | `/me` | auth | Current user |
| POST | `/forgot-password` | public, rate limited | Same response whether or not the email exists |
| POST | `/reset-password` | public, rate limited | `token, new_password`; revokes all sessions |
| POST | `/verify-email/request` · `/verify-email` | public, rate limited | Email-verification tokens |

With `X-Session-Mode: cookie`, register/login/refresh set the refresh token as an `HttpOnly`,
`SameSite=Strict` cookie and return an empty `refresh_token` in the body.

## Verification and account workflow — `/workflow` (auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard` | Account, profile, verification, own documents, required document types |
| PUT | `/profile` | Whitelisted profile fields; fields under review are locked while pending |
| POST | `/verification/documents` | Multipart `document_type`, `document`; tutor/coaching only; creates a draft application |
| GET | `/verification/documents/:id` | The picture; owner or admin only (others 404) |
| POST | `/verification/submit` | 422 with `missing` until required pictures and profile exist |
| GET | `/notifications` · POST `/notifications/read` | `{"id"}` or `{}` for all |
| GET/POST | `/relationships` | Older guardian-link endpoint (superseded by `/links`) |
| GET | `/tuition` | Older listing endpoint for active accounts (superseded by `/tuition-posts`) |

Admin — `/workflow/admin` (role admin):

| Method | Path | Notes |
|---|---|---|
| GET | `/verifications?status=&role=` | Submitted applications with profile, interviews, counts |
| GET | `/verifications/:id/documents` · `/verifications/:id/history` | Document metadata; audit trail |
| POST | `/verifications/:id/decision` | `approved`, `rejected`, `resubmission_required` (reason ≥ 10 chars for the last two) |
| POST | `/verifications/:id/interviews` · `/verifications/:id/interviews/:interviewID/outcome` | Optional interview step |
| GET | `/stats` · `/users?role=&status=&q=&limit=&offset=` · `/audit-logs?action=` | Dashboard data |
| POST | `/users/:id/suspend` · `/users/:id/reactivate` | Suspension revokes all sessions |

## Public discovery — `/public` (optional)

| Method | Path | Notes |
|---|---|---|
| GET | `/tutors?subject=&class=&area=&mode=&max_fee=&q=` · `/tutors/:id` | Verified, listed tutors only; no contact details; profile includes reviews and awards |
| GET | `/coaching?subject=&area=&q=` · `/coaching/:id` | Verified centres with teachers and batches |
| GET | `/tuition?...` · `/tuition/:id` | Open tuition posts |
| GET | `/users/:id/photo` | Public for listed tutors/centres; otherwise self, admin or conversation partners |
| GET | `/info` | Support email, maintenance banner, registrations-open flag |
| POST | `/contact` | Anonymous support request (10 per IP per hour) |

## Marketplace (auth)

| Method | Path | Access / notes |
|---|---|---|
| GET | `/tuition-posts?...&saved=1` | Search with the caller's application status and saved flag |
| GET | `/tuition-posts/mine` | Caller's posts |
| POST | `/tuition-posts` | parent (optionally for a linked child) or student |
| PUT | `/tuition-posts/:id` · POST `/tuition-posts/:id/status` | Poster (or admin); closed posts cannot reopen |
| POST | `/tuition-posts/:id/apply` | Active tutor; respects platform settings and daily limit |
| GET | `/tuition-posts/:id/applications` | Poster or admin |
| POST/DELETE | `/tuition-posts/:id/save` | Save / unsave |
| GET | `/applications/mine` | Tutor's applications |
| POST | `/applications/:id/status` | Tutor: `withdrawn`; poster: `shortlisted`, `declined`, `accepted` (accept opens a conversation) |
| POST | `/profile/photo` | Multipart `photo` (JPEG/PNG/WebP) |
| GET | `/users/:id/awards` · `/users/:id/reviews` | |
| POST/DELETE | `/users/:id/block` | Block / unblock |

## Guardian links and progress (auth)

| Method | Path | Access / notes |
|---|---|---|
| GET | `/links` | Caller's links (as guardian or student) |
| POST | `/links` | parent; `student_email, relationship`; the student must approve |
| POST | `/links/:id/respond` | Student approves/refuses; either side may revoke an approved link |
| GET | `/students/:id/progress` | The student, an approved guardian, a teacher of their classroom, or admin |
| GET | `/results` | Published coaching exam results for the student or their linked guardian |

## Messaging (auth)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/chat-requests` | Parent/student → verified tutor or centre; one pending per pair |
| POST | `/chat-requests/:id/accept` · `/decline` · `/cancel` | Recipient accepts/declines; sender cancels |
| GET | `/conversations` · `/conversations/unread` | Participants only |
| GET | `/conversations/:id/messages?after=` | Incremental polling |
| POST | `/conversations/:id/messages` · `/conversations/:id/read` | Blocked pairs cannot message |

## Tuitions, payments and reviews (auth)

| Method | Path | Notes |
|---|---|---|
| GET | `/engagements` | Caller's tuitions; contact details only once active |
| POST | `/engagements` | Parent/student with an existing conversation; demo-class request (`trial_at`) or terms |
| POST | `/engagements/:id/actions` | `accept_trial`, `decline_trial`, `propose`, `confirm`, `cancel`, `complete` |
| GET/POST | `/engagements/:id/payments` | Tutor `due`; guardian `mark_paid`; tutor `confirm`; either `dispute` |
| POST | `/engagements/:id/review` | Guardian/student, tuition active or completed |
| POST | `/reviews/:id/reply` | Reviewed tutor |

## Classrooms (auth; owner = the tutor or coaching centre running it)

| Method | Path | Access |
|---|---|---|
| GET | `/classrooms` · `/classrooms/:id` | Owner, member student, approved guardian of a member, admin |
| POST | `/classrooms` | Active tutor or coaching centre |
| POST · DELETE | `/classrooms/:id/members` · `/classrooms/:id/members/:student` | Owner |
| POST | `/classrooms/:id/materials` (multipart, picture or PDF) · GET `/materials/:id/file` | Owner adds; viewers download |
| POST | `/classrooms/:id/assignments` | Owner |
| POST | `/assignments/:id/submit` (multipart) | Member student |
| GET | `/assignments/:id/submissions` | Owner; students see their own; guardians their child's |
| POST | `/submissions/:id/review` · GET `/submissions/:id/file` | Owner grades; file to owner, the student, their guardian, admin |
| POST | `/classrooms/:id/sessions` · `/sessions/:id/status` · `/sessions/:id/attendance` | Owner |
| POST | `/classrooms/:id/diary` | Owner |

## Coaching — `/coaching` (role coaching; every query scoped to the caller)

| Method | Path |
|---|---|
| GET/POST, PUT `/:id` | `/teachers`, `/courses`, `/branches`, `/students`, `/batches` |
| GET | `/batches/:id/learners` |
| POST/DELETE | `/batches/:id/enrollments/:student` (capacity enforced) |
| GET/POST | `/exams` · GET/POST `/exams/:id/marks` (`publish` locks marks) |
| GET | `/fees?month=` · POST `/fees/generate` · POST `/fees/:id/paid` · `/waive` · `/remind` |
| GET | `/report` |

## Support (auth)

| Method | Path |
|---|---|
| POST | `/support-tickets` (categories: support, complaint, report_user, report_post, safety, payment, appeal) |
| GET | `/support-tickets/mine` |

## Platform administration — `/admin` (role admin)

| Method | Path | Notes |
|---|---|---|
| GET · POST | `/tickets?status=&category=` · `/tickets/:id` | Resolution required to resolve/close; reporter notified |
| GET · POST | `/tuition-posts` · `/tuition-posts/:id/status` | Moderation, audited |
| GET · PUT | `/settings` | Typed whitelist: `registrations_open`, `tutor_applications_open`, `max_applications_per_day`, `support_email`, `maintenance_banner` |
| POST | `/announcements` | Notification to all users or one role |
| POST | `/awards` | Tutors and coaching centres |
| GET | `/users/:id` · `/reports?from=&to=` · `/engagements` · `/reviews` · `/payments` · `/suspicious` | |
