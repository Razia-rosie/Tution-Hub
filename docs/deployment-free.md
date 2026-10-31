# Free ($0) deployment: Vercel Hobby + TiDB Cloud Starter

This plan runs the existing React frontend and Go/Gin API together on one Vercel Hobby project and
uses TiDB Cloud Starter as a MySQL-compatible database. Neither needs a payment method. It is
suitable for a portfolio or demo: Vercel Hobby is for non-commercial, personal use only.

**Status:** prepared, not deployed. Limits below were checked against the providers' official
documentation in October 2026; free tiers change, so re-check the linked pages before deploying.

## Architecture

```text
Browser ──> https://<project>.vercel.app      (one Vercel project, "Services")
              ├─ /        → web: React/Vite static build
              └─ /api/*   → api: Go + Gin server from backend/ (Vercel Go runtime)
                               │ TLS
                               ▼
                      TiDB Cloud Starter (MySQL-compatible)
                        all tables + uploaded files (stored_files)
```

Same origin for site and API, so the `SameSite=Strict` session cookie works without CORS.

## Free limits and what happens when they run out

| Provider | Free allowance | When exceeded | Docs |
|---|---|---|---|
| Vercel Hobby | 4 Active CPU-hours, 360 GB-hours memory, 1M invocations, 100 GB Fast Data Transfer per month; 300 s per request; 4.5 MB request/response body | No charge; the feature pauses until 30 days pass | [Hobby](https://vercel.com/docs/plans/hobby), [function limits](https://vercel.com/docs/functions/limitations), [Go runtime](https://vercel.com/docs/functions/runtimes/go), [Services](https://vercel.com/docs/services) |
| TiDB Cloud Starter | 5 GiB row storage and 50M Request Units per instance per month (25 GiB / 250M per organization, up to 5 free instances); 400 connections | Instance is throttled and new connections are refused until next month; no charge with a spending limit of 0 | [pricing](https://www.pingcap.com/tidb-cloud-starter-pricing-details/), [limits](https://docs.pingcap.com/tidbcloud/serverless-limitations/), [plans](https://docs.pingcap.com/tidbcloud/select-cluster-tier/) |

- **Sleeping:** the API runs as Vercel Functions on Fluid compute. It scales to zero when idle and
  starts on the next request, so the first request after a quiet period is slower.
- **Persistence:** data lives in TiDB, which has no free-tier expiry. Files are stored in TiDB too
  (`FILE_STORAGE=database`), because Vercel Functions have no persistent disk.
- **Beta:** the Vercel Go runtime and Services are in Beta.

## What the code does differently in this mode

All controlled by environment variables; local development is unchanged.

| Setting | Value on Vercel | Why |
|---|---|---|
| `FILE_STORAGE` | `database` | Uploads go to the `stored_files` table (migration `005`) |
| `MAX_UPLOAD_MB` / `VITE_MAX_UPLOAD_MB` | `4` | Vercel rejects request bodies over 4.5 MB |
| `CLIENT_IP_HEADER` | `X-Real-IP` | Vercel overwrites this header with the real client IP, so per-IP rate limits work |
| `PORT` | set by Vercel | The API listens on `:$PORT` when `HTTP_ADDR` is unset |

Rate limits are kept in memory per running instance, so they are looser than on a single server.
There is no email provider, so password-reset emails are not sent in production.

## Setup steps

### 1. Create the database (no card)

1. Sign up at [tidbcloud.com](https://tidbcloud.com) (GitHub, Google or email).
2. Create a **Starter** instance. Choose the AWS region closest to your users (for example
   Singapore, if listed) and keep the spending limit at **0**.
3. Open **Connect**, choose a general/Go connection and generate a password. Keep the host, user
   and password private: never paste them into chat, issues or commits.
4. Your `DATABASE_URL` has this shape (TiDB requires TLS):

   ```text
   USER:PASSWORD@tcp(HOST:4000)/tuitionhub?parseTime=true&charset=utf8mb4&loc=UTC&tls=true
   ```

   Create the `tuitionhub` database first in the TiDB SQL editor: `CREATE DATABASE tuitionhub;`

### 2. Create the tables

From `backend/`, in your own terminal (the value stays in your shell history only; use
`read -r -s` to avoid even that):

```sh
read -r -s DATABASE_URL && export DATABASE_URL
DATABASE_URL="$DATABASE_URL&multiStatements=true" go run ./cmd/migrate
```

### 3. Create the administrator

Use a **new** strong password, not a local one. Do not load the demo accounts: their passwords are
public.

```sh
read -r -s ADMIN_BOOTSTRAP_PASSWORD && export ADMIN_BOOTSTRAP_PASSWORD
JWT_SECRET="$(openssl rand -base64 48)" go run ./cmd/bootstrap-admin -name "Your Name" -email "you@example.com"
unset ADMIN_BOOTSTRAP_PASSWORD DATABASE_URL
```

### 4. Create the Vercel project

1. In Vercel, use a **new or empty** project (for example the empty `tuitionhub` project). Do not
   change `tuitionhub-tutoring-marketplace`, which serves a different repository.
2. Import `Razia-rosie/Tution-Hub`. `vercel.json` defines the `web` and `api` services.
3. **Settings → Functions → Region:** pick the region closest to the TiDB instance (for example
   Singapore, `sin1`).
4. **Settings → Environment Variables** (Production):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | from step 1 (with `tls=true`) |
   | `JWT_SECRET` | a new random value: `openssl rand -base64 48` |
   | `APP_ENV` | `production` |
   | `COOKIE_SECURE` | `true` |
   | `FILE_STORAGE` | `database` |
   | `MAX_UPLOAD_MB` | `4` |
   | `VITE_MAX_UPLOAD_MB` | `4` |
   | `CLIENT_IP_HEADER` | `X-Real-IP` |

5. Keep **Deployment Protection** on Standard Protection: preview URLs need a Vercel login, the
   production domain is public.
6. Deploy.

### 5. Check the deployment

- `https://<project>.vercel.app/api/v1/public/info` returns JSON.
- Sign up as a tutor, upload a verification picture (under 4 MB), submit.
- Sign in at `/admin/login`, open the picture, approve.
- Refresh the page: you stay signed in. Sign out and back in.
- In the browser's developer tools, the `th_refresh` cookie is `HttpOnly`, `Secure`, `SameSite=Strict`.

## Not covered

- Email delivery (password reset) — needs a provider and code to send mail.
- Backups — export data from TiDB periodically if it matters.
- Commercial use — requires a paid Vercel plan.
