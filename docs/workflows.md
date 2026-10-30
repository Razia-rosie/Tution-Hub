# Workflows

## Manual verification (tutors and coaching centres)

Required pictures: tutor `identity` (+ optional `education`); coaching `trade_license` and
`owner_identity`. Accepted: real JPEG, PNG or WebP, ≤ 10 MB and ≤ 40 megapixels (sniffed and
fully decoded server-side). Students and parents are not verified and start `active`.

```
register (account pending)
  → upload pictures (creates a draft application)
  → complete profile → submit ──(422 lists anything missing)
  → pending (pictures and reviewed profile fields locked)
  → admin reviews pictures and details (optional interview)
      ├─ approve  → account active (restricted features unlock)
      ├─ reject   → final; reason shown to the applicant
      └─ request corrections → resubmission_required
             → applicant replaces pictures / edits details → resubmits → pending
```

Every upload, administrator picture view, decision, interview and resubmission is written to
`audit_logs`, and each decision sends a notification. There is no OCR, AI or automatic approval.

## Finding and hiring a tutor

1. **Discovery** – parents and students search verified tutors and coaching centres (public), or
   publish a tuition post.
2. **Contact** – either a tutor applies to a post and the poster accepts the application, or a
   parent/student sends a chat request that the tutor accepts. Both open a conversation. Tutors
   cannot cold-message families.
3. **Demo class** – from the conversation, the parent or student requests a demo class
   (`trial_requested`); the tutor accepts or declines.
4. **Terms** – either side proposes days, time, mode, location, monthly fee and start date.
   Proposing resets the other side's confirmation.
5. **Confirmation** – when both sides have confirmed, the tuition becomes `active`: a classroom is
   created with the student as a member, the tuition post is marked filled, and email/phone are
   shared between tutor and guardian.
6. **Running and ending** – fees are tracked monthly; either side may complete or cancel (with a
   reason); guardians and students can review the tutor once the tuition is active or completed.

## Guardian links

A parent requests a link using the child's student-account email; the student approves or
refuses from their profile. Only approved links give the parent read access to the child's
classrooms, attendance, homework, progress and results. Either side may revoke an approved link.

## Classrooms

- The owner (tutor or coaching centre) schedules classes (optionally weekly), cancels or
  reschedules them, marks attendance, publishes homework/assignments with due dates and maximum
  scores, grades submissions or asks for revisions, shares materials and writes the daily diary.
- Students submit a note and/or a picture or PDF; reviewed work is locked.
- Absences notify the student's approved guardians. Schedule changes, new homework, grades and
  diary entries notify members and their guardians.

## Fees (tracking only)

Tutor records a month as due → guardian marks it paid (optionally with a reference) → tutor
confirms receipt. Either side can dispute an unconfirmed record. TuitionHub never moves money.

## Coaching centres

Branches, teachers and courses → admit students to the roster (optionally linking existing
student and guardian accounts) → create batches (each gets a classroom) → enrol students
(capacity enforced) → classes, attendance and homework through the batch classroom → exams with
mark entry and publishing (published marks are locked and notified) → generate monthly fees from
batch fees, record payments, waive or remind → operational report.

## Administration

Admins work the verification queue, manage users (suspension ends all sessions immediately and is
reversible), moderate tuition posts, handle support tickets (the reporter is notified), watch the
suspicious-activity list (repeated failed logins, multiple reports), grant awards, send
announcements, change platform settings and read the audit log. Admins cannot be suspended from
the UI and cannot register publicly.
