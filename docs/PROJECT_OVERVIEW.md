# Project overview

## What TuitionHub is

TuitionHub is a web platform for private tuition in Bangladesh. It connects guardians and students
with **manually verified** private tutors and coaching centres, and then manages the tuition after
hiring: classes, attendance, homework, grades, study materials, a daily diary and monthly fees.

Live site: https://tuitionhub-omega.vercel.app

## The problem

Private tuition is a large, mostly informal market in Bangladesh. Families typically find tutors
through acquaintances, social-media groups or agents, which causes recurring problems:

- **Trust:** guardians cannot easily check that a tutor or coaching centre is genuine.
- **Privacy and safety:** phone numbers and home addresses are shared with strangers before anyone
  has agreed to anything.
- **No shared record:** once teaching starts, attendance, homework, grades and fee payments live in
  memory, notebooks or chat threads, and guardians have little visibility.
- **Coaching centres** juggle rosters, batches, exam marks and fees in spreadsheets.

## How TuitionHub addresses it

| Problem | TuitionHub feature |
|---|---|
| Trust | Every tutor and coaching centre uploads pictures of identity documents (and a trade licence for centres). An administrator reviews them by hand and approves, rejects with a reason, or asks for corrections. Only approved profiles are listed publicly. |
| Privacy | Families and tutors talk inside the platform. Email and phone are shared only after both sides confirm a tuition. Uploaded documents are visible only to their owner and administrators, and every administrator view is audited. |
| Shared record | Each confirmed tuition gets a classroom with schedule, attendance, homework and grading, materials, a daily diary and progress summaries. Guardians linked to a student see that student's classes. |
| Coaching operations | Branches, teachers, courses, student roster, batches with capacity, exams with publish-locked marks, monthly fee generation and reminders, and an operational report. |
| Fees | Monthly fee records with a due → marked paid → confirmed (or disputed) flow. TuitionHub tracks fees; it does not move money. |

## Who uses it

| Role | Typical user |
|---|---|
| Private tutor | University students and graduates who teach school, SSC and HSC subjects |
| Coaching centre | Local institutes running batches for SSC, HSC and admission preparation |
| Guardian / parent | Parents looking for a tutor and following their child's tuition |
| Student | School and college students who attend classes and submit homework |
| Administrator | The platform team that verifies tutors and centres and moderates the platform |

## Design principles

- **Manual verification only.** Pictures are evidence for a human reviewer. The server checks that
  uploads are genuine images but never reads, scores or approves their content automatically.
- **Least exposure of personal data.** Contact details are revealed only after mutual agreement;
  objects a user may not see return "not found".
- **Students consent to guardians.** A parent's access to a child's classes requires the child's
  approval of the link.
- **Additive database changes.** Migrations never drop or delete data.

## Status

- Deployed at $0 on Vercel Hobby with TiDB Cloud Starter (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- Feature set implemented and covered by automated tests locally (see [TESTING.md](TESTING.md)).
- Not implemented: email delivery, SMS/OTP, online payments, real-time push
  (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)).
- Suitable for demonstration and academic evaluation; Vercel Hobby is limited to non-commercial use.
