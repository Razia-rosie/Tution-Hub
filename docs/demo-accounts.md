# Demo accounts (development only)

`scripts/seed-demo.mjs` creates eight demo accounts in a **local development database**: two each
of tutor, coaching centre, guardian and student, connected to each other so every workflow can be
tried by hand. It never runs against production, and no password is stored in this repository.

## What it creates

| Key | Role | Email | State after seeding |
|---|---|---|---|
| tutor1 | Tutor | `demo.tutor1@example.test` | Approved through the admin workflow; listed publicly |
| tutor2 | Tutor | `demo.tutor2@example.test` | Pictures uploaded and submitted; **waiting for admin review** |
| coaching1 | Coaching centre | `demo.coaching1@example.test` | Approved; teachers, course, branch, two batches, exam, fees |
| coaching2 | Coaching centre | `demo.coaching2@example.test` | Submitted; **waiting for admin review** |
| parent1 | Guardian | `demo.parent1@example.test` | Linked to student1; active tuition with tutor1 |
| parent2 | Guardian | `demo.parent2@example.test` | Linked to student2; open post with tutor1's application; chat request pending |
| student1 | Student | `demo.student1@example.test` | Classroom with notes, a graded worksheet and an open model test |
| student2 | Student | `demo.student2@example.test` | Enrolled in a coaching batch with a published result |

`example.test` is a reserved domain: no real mailbox exists. Email addresses are confirmed with the
development token workflow (the API returns the token instead of sending mail on non-production
servers).

Connected records include guardian links, three tuition posts, applications, a conversation, a
demo class and confirmed tuition agreement, a classroom (materials, assignments, a graded
submission, four scheduled classes, attendance, diary), a confirmed monthly payment, a review, a
coaching roster with enrolments, attendance, homework, published exam marks and fees, and a
support ticket. Some steps are left open on purpose so they can be done by hand: tutor2 and
coaching2 await review, parent2's chat request and tutor1's application to parent2 await an answer,
and student1's model test awaits submission.

## How it works

- Everything goes through the HTTP API, exactly as the web app does. Tutors and centres upload
  pictures and submit; approval is an administrator decision through the admin endpoint.
- Running it again creates nothing twice. Profile fields are only filled when empty, so edits made
  in the app survive a rerun.
- Safety: it requires `--yes`, refuses any API that is not on `localhost`, refuses
  `APP_ENV=production`, and stops if the server does not return a development email token.
- Passwords are generated on first run into **`.env.demo.local`** (git-ignored, readable only by
  your user). A private credential report is written to **`.runtime/demo-accounts-<label>.md`**
  (git-ignored).

## Running it

Against the development stack started with `make up` (database `tuitionhub`):

```sh
DEMO_API=http://localhost:8080 node scripts/seed-demo.mjs --yes
```

To record the approval of tutor1 and coaching1 automatically, provide an administrator login for
that database in the shell (or in `.env.demo.local` as `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`).
Without it, approve them yourself in the admin dashboard and run the script again to add the
tuition, classroom and coaching records.

The registration endpoints are rate-limited (20 requests per hour per address by default), so a
first run may defer some email confirmations; run it again later to finish.

Against the isolated test stack (`tuitionhub_e2e`, see [testing.md](testing.md)):

```sh
DEMO_API=http://localhost:8090 DEMO_LABEL=e2e DEMO_ADMIN_EMAIL=... DEMO_ADMIN_PASSWORD=... node scripts/seed-demo.mjs --yes
```

## Checking the accounts

`tests/demo-accounts.mjs` signs in as every account through the API and the real login page,
checks their connected records and role permissions, and performs update/add/remove round trips
that it reverts before finishing:

```sh
DEMO_API=http://localhost:8090 DEMO_WEB=http://127.0.0.1:5174 node tests/demo-accounts.mjs
```

## Removing them

There is no delete script. Demo users can be suspended from the admin dashboard; deleting rows
should only be done deliberately on a development database after a backup.
