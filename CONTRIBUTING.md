# Contributing

## Workflow

1. Branch from `main` (`feature/<topic>`, `fix/<topic>`, `docs/<topic>`).
2. Make focused changes that follow the surrounding code's style.
3. Run the checks below, then open a pull request describing what changed and how it was tested.

## Checks before committing

```sh
cd backend && gofmt -l . && go vet ./... && go test ./...
cd .. && npx tsc --noEmit -p . && pnpm build
```

For changes to API behaviour, permissions or UI flows, also run the integration, API and browser
suites against the isolated `tuitionhub_e2e` database ([docs/testing.md](docs/testing.md)) and add
checks for new behaviour. `pnpm build` alone does not type-check.

## Commit messages

Use conventional prefixes with an imperative summary:

| Prefix | For |
|---|---|
| `feat:` | New user-visible functionality |
| `fix:` | Bug fixes |
| `security:` | Security hardening |
| `docs:` | Documentation only |
| `test:` | Tests only |
| `refactor:` | Behaviour-preserving code changes |
| `chore:` | Tooling, configuration, dependencies |

Explain *why* in the body when it is not obvious.

## Conventions

- **Database**: add a new numbered file in `backend/migrations/`; changes must be additive and
  safe to re-run (guard columns and indexes with `information_schema` checks). Never edit an
  applied migration. Apply with `go run ./cmd/migrate` after a backup.
- **Backend**: parameterised SQL only; check roles and object ownership in the service; return
  404 for objects the caller may not see; write notifications and audit entries for important
  actions.
- **Frontend**: add API calls to `src/lib/platform.ts` (or `src/lib/api.ts` for auth); load data
  with `useLoad`; every new navigation item must map to a real screen in `src/pages/RolePage.tsx`.
  No sample or placeholder data in user-facing screens.
- **Strings**: use double quotes for strings containing apostrophes in TypeScript.
- **Verification** stays manual and picture-only (JPEG/PNG/WebP); do not add automated
  document checks.

## Never commit

`.env` files, real credentials or secrets, uploaded documents (`private_documents/`), database
dumps (`backend/backups/`), runtime logs (`.runtime/`), build output (`dist/`, `backend/tmp/`).
