# TuitionHub documentation

TuitionHub is a tutoring marketplace and tuition-management platform for Bangladesh: a React
single-page app (`src/`) talking to a Go REST API (`backend/`) backed by MySQL 8.

| Document | What it covers |
|---|---|
| [architecture.md](architecture.md) | System overview, request lifecycle, repository layout, frontend structure |
| [setup.md](setup.md) | Local development, environment variables, migrations, first administrator |
| [api.md](api.md) | Endpoint reference grouped by area, with access rules |
| [database.md](database.md) | Tables, relationships, constraints, migration policy |
| [workflows.md](workflows.md) | Verification, hiring, tuition agreement, classroom and coaching rules |
| [security.md](security.md) | Authentication, sessions, access control, uploads, rate limiting, audit |
| [testing.md](testing.md) | Test suites and how to run them against an isolated database |
| [deployment.md](deployment.md) | Requirements for a production deployment |
| [known-issues.md](known-issues.md) | Open gaps, technical debt and untested areas |

Also see the top-level [README](../README.md), [PROGRESS.md](../PROGRESS.md) (phase status
and priorities), [PROJECT_HANDOFF.md](../PROJECT_HANDOFF.md), [CHANGELOG.md](../CHANGELOG.md),
[CONTRIBUTING.md](../CONTRIBUTING.md), [SECURITY.md](../SECURITY.md) and
[backend/README.md](../backend/README.md) (backend-specific notes).
