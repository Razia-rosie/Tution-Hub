# Known issues and technical debt

Verified against the code; ordered roughly by impact.

## Missing integrations

- **Email**: no provider. Password-reset and verification links are returned by the API only on
  non-production servers; in production nobody receives them.
- **SMS / OTP**: not implemented.
- **Online payments**: fees are recorded, not collected.

## Functional gaps

- Messages and notifications use **polling** (open chat every 4 s, conversation list every 12 s,
  notification badge on load and after changes); no WebSocket/SSE push.
- **Coaching teachers** are records managed by the centre, not user accounts with their own login.
- Students can create tuition posts through the API, but only parents have a posting screen.
- Administrators can view reviews but not hide or delete them (abuse goes through reports).
- Ranking is the tutor's position by rating within each subject; there is no separate trust score.
- `/workflow/relationships` and `/workflow/tuition` are older endpoints superseded by `/links`
  and `/tuition-posts`; they remain for compatibility.

## Data integrity

- `tuition_listings.student_id` has no foreign key; `attendance_marks.learner_id` is polymorphic
  (user or roster) with no foreign key. Both are checked in code only.
- `interviews.scheduled_by` has no `ON DELETE` action, so deleting an administrator who scheduled
  interviews fails.
- Exam-mark locking after publication is enforced in code, not by the database.

## Performance and scale

- No pagination on several lists: conversations (uncapped), chat requests (200), classroom
  sessions (200), messages (500 per fetch), results (200), diary (100).
- Rate limits are in memory per process (reset on restart; not shared across instances).
- Every authenticated request reads the account from the database.
- The frontend bundle is code-split; the main chunk is about 339 KB (101 KB gzipped).

## Security and operations

- Uploads live on local disk with no malware scanning or off-site copy.
- No deployment, monitoring or backup automation exists yet ([deployment.md](deployment.md)).
- An early public commit (`02714ca`) contains a compiled development binary
  (`backend/tmp/main`). It holds no secrets (configuration comes from the environment) and was
  untracked later; history was intentionally not rewritten.

## Not yet verified

- Behaviour on Safari, Firefox and real mobile devices (browser tests use desktop Chrome with
  mobile and tablet viewports).
- Load and concurrency beyond the single-user test journeys.
- Accessibility with screen readers (labels and focus states exist but no audit was run).
