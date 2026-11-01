# Release notes — v1.0.0 (prepared, not yet tagged)

First public release of TuitionHub: a verified, safety-first tutoring marketplace and
tuition-management platform for Bangladesh.

**Live:** https://tuitionhub-omega.vercel.app · **Docs:** [docs/README.md](README.md)

> No Git tag or GitHub release exists yet. Tag `v1.0.0` on `main` after pull request #1 is merged
> (see "Publishing" below), so the tag points at the code that runs the live site.

## Highlights

- **Manual, picture-based verification** of private tutors and coaching centres by an
  administrator: approve, reject with a reason, or request corrections. No automated document checks.
- **Five roles** — tutor, coaching centre, guardian, student, administrator — each with its own
  dashboard and screens backed by the API.
- **Hiring flow:** tuition posts and applications, chat requests, messaging, demo class, two-sided
  confirmation of terms; contact details shared only after both confirm.
- **Classrooms:** schedule, attendance with absence alerts, homework and grading, materials, daily
  diary, progress; guardians see their linked children's classes.
- **Coaching management:** branches, teachers, courses, roster, batches, exams with publish-locked
  marks, monthly fees and reports.
- **Administration:** verification queue, user suspension, post moderation, support tickets,
  suspicious activity, awards, announcements, settings, audit log, reports.
- **Security:** bcrypt passwords, short-lived JWTs with session binding, rotating refresh tokens in
  an `HttpOnly; Secure; SameSite=Strict` cookie, per-request account checks, rate limits, fully
  decoded image uploads, private file delivery.
- **$0 hosting:** Vercel Hobby (website + Go API) and TiDB Cloud Starter (Singapore).

## Verification

- Automated (local): API suites 119/119 and 169/169, browser suites 60/60 and 34/34, Go unit and
  integration tests, static checks — all passing ([TESTING.md](TESTING.md)).
- Live: sign-up → login → profile → picture upload → submit → admin approval → public listing,
  plus cookie, upload-limit and access checks — all passing.
- Software Test Report: 128 cases, 115 pass, 2 fail, 2 blocked, 9 not tested; core coverage 45.2%.

## Known limitations

No email delivery (password reset), SMS/OTP or online payments; messages and notifications poll
rather than push; rate limits are per instance; no CI; Vercel Hobby is for non-commercial use.
Full list: [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Upgrade notes

Apply migrations `004_session_ids.sql` and `005_stored_files.sql` with `go run ./cmd/migrate`
(additive; back up first). Production settings are listed in [DEPLOYMENT.md](DEPLOYMENT.md).

## Publishing

After merging pull request #1:

```sh
git checkout main && git pull
git tag -a v1.0.0 -m "TuitionHub v1.0.0"
git push origin v1.0.0
gh release create v1.0.0 --title "TuitionHub v1.0.0" --notes-file docs/RELEASE_NOTES.md
```
