# TuitionHub — test results summary (report v1.0.2)

Companion to `TuitionHub_Software_Test_Report.docx`. All figures come from `reports/evidence/`.
Earlier runs are kept for traceability:
- `reports/evidence/baseline-8255aff/`: first run, where the defects were found
- `reports/evidence/v1.0.1-b0536fa/`: re-test after the DEF-01 and DEF-02 fixes

**Version tested:** branch `feature/verification-workflow`, commit `c58399f`. The tests ran on HEAD
`b0536fa` plus the DEF-03 working-tree change, which was then committed unchanged as `c58399f`. The
sha256 of the committed diff of the tracked files matches the hash recorded before the run
(`dab4564c2b45…`), and the new test file was not modified.

The branch is 3 local commits ahead of `origin/main` (`8255aff`): `01cd277` (DEF-01), `b0536fa` (DEF-02)
and `c58399f` (DEF-03). Nothing is pushed.

- **Environment:** 2026-10-31, macOS 26.3 / Apple M4, Go 1.25.4, Node 26.8.1, MySQL 8.4.13 (Docker), Chrome 156
- **Test database:** `tuitionhub_qa_e2e` (isolated; migrations 001–004). The test runs made only
  aggregate reads of the local `tuitionhub` database: 13 users, 236 refresh tokens, all with a session ID.

## Test cases (128 specified)

| Status | Count |
|---|---|
| PASS | 115 |
| FAIL | 2 |
| BLOCKED | 2 |
| NOT TESTED | 9 |

Pass percentage = 115 passed ÷ 117 executed (PASS + FAIL) = **98.3%**. BLOCKED and NOT TESTED cases
are excluded from the denominator. Priority-1 cases: **78 / 78 passed**.

## Automated suites (full re-run of the code committed as `c58399f`, first-run results)

| Suite | Result |
|---|---|
| `go test -count=1 -v ./...` (unit) | 27 top-level tests, all pass |
| `go test -tags integration ./internal/integration` | 13 tests/subtests, all pass |
| `tests/verification-e2e.mjs` | 119 / 119 |
| `tests/platform-e2e.mjs` | 169 / 169 |
| `tests/browser-e2e.mjs` | 60 / 60 |
| `tests/journeys-browser.mjs` | 34 / 34 |
| `gofmt -l .`, `go vet ./...` (including the integration tag), `npx tsc --noEmit -p .`, `pnpm build` | all clean |
| Manual API/security probes | 59 / 59 |

## Fixed defects (verified by re-test)

| ID | Sev | Found at `8255aff` | Fix | Re-test result |
|---|---|---|---|---|
| DEF-01 | S2 | 29.84% / 32.75% HTTP 500 on public search at 20 concurrent clients | `01cd277`: MySQL pool configured (25 open / 25 idle / 5m) | 0 errors at 20 clients (3,343 and 5,132 req/s) and at 50 clients; 0 HTTP 500 lines in the API log |
| DEF-02 | S3 | access token returned 200 after logout and after password reset | `b0536fa`: session-bound access tokens (`sid` claim, migration 004) | 401 after logout and after reset; the 4 integration subtests pass; suspension still returns 403 |
| DEF-03 | S3 | a whitespace-only name returned 201 and was stored empty | `c58399f`: the registration name is trimmed before the existing `min=2,max=120` rule | 400 for blank names; padded names stored trimmed; 3 unit tests + 1 integration test pass (the unit tests failed against the old handler) |

## Open defects

| ID | Sev | Summary |
|---|---|---|
| DEF-04 | S3 | Dev-dependency advisories (vite, source-map-js): 2 high, 5 moderate, 1 low; not re-fixed |
| DEF-05 | S4 | `PROGRESS.md` says the original DB has 3 users and no admin; it actually has 13 users including 1 admin |

## Not tested / blocked

- **Not implemented:** email delivery (BLOCKED), SMS/OTP, online payments, real-time push,
  coaching-teacher logins, review moderation. The student posting screen is partially implemented
  (API only).
- **Not available:** govulncheck (BLOCKED), OWASP ZAP, Lighthouse/axe, Safari/Firefox/real devices,
  SonarCloud, usability participants, CI. The report was validated programmatically only; Microsoft
  Word and LibreOffice are not installed.

## Exit criteria (Baseline tier)

6 of 9 met; 1 is not applicable (branch coverage is not measured). Not met:
- Core coverage is 45.2% of statements, below the 60% target.
- There is no CI pipeline.

No S1 or S2 defect is open.

## Recommendation

**Go with known issues** for the academic demonstration. Production
still needs an email provider, HTTPS with Secure cookies, CI, migration 004 on the target database, and
deployment hardening.
