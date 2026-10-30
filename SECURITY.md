# Security policy

## Reporting a vulnerability

Please do **not** describe a vulnerability in a public issue. Instead, open an issue titled
"Security contact request" with no technical details, and the maintainer
([@Razia-rosie](https://github.com/Razia-rosie)) will arrange a private channel. If the
repository's Security tab shows a **Report a vulnerability** button, use that instead.

When reporting, include the affected endpoint or screen, steps to reproduce and the impact you
observed. Do not access other users' data beyond what is needed to demonstrate the issue.

## Scope

TuitionHub stores identity-document pictures and information about children, so the following
are treated as high priority:

- Access to another user's verification pictures, messages, classrooms or children's data.
- Authentication or session bypass, privilege escalation to administrator.
- Upload handling that accepts non-image content or exposes stored files.

## Supported versions

Only the current `main` branch is supported. The application is not yet deployed publicly.

## How the application protects data

See [docs/security.md](docs/security.md).
