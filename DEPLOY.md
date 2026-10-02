# Nixify — Production Deployment Guide

This guide describes the **current** production deployment architecture and the
**migration-safe** operator procedure. It reflects the repository as it exists
today — not legacy instructions.

## Current architecture (source of truth)

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Runtime / package manager | Bun 1.3.14 |
| ORM | Prisma 6 |
| Database provider | PostgreSQL (the schema is already `provider = "postgresql"` — there is no SQLite path) |
| Production database | Neon (PostgreSQL) |
| Production hosting | Vercel |
| Canonical production origin | `https://nixify.ir` |
| Email delivery | SMTP via Nodemailer (configurable provider) |
| Rate limiting | DB-backed buckets (serverless-safe — no Redis required) |
| Scheduled jobs | **External cron service** (e.g. cron-job.org) hitting `POST /api/webhooks/process-queue`. Vercel Cron is **not** used. |

The Prisma schema (`prisma/schema.prisma`) is PostgreSQL-only. The repository
ships committed Prisma migrations under `prisma/migrations/` — these are the
**only** production schema-evolution path.

## Production schema evolution — `prisma migrate deploy` ONLY

Production schema changes must use committed Prisma migrations:

```bash
DATABASE_URL='<Neon direct connection string>' bunx prisma migrate deploy
```

The following commands are **forbidden against production** (see
`docs/engineering/reliability-protocol.md` §6):

```text
prisma db push         # schema drift, no migration record
prisma migrate reset    # destroys all data
prisma migrate dev      # interactive migration creation (dev-only)
prisma db seed          # no automatic production seeding
```

The `db:push`, `db:reset`, `db:migrate`, `db:seed`, and `seed` npm scripts are
guarded by `scripts/db-safety-guard.sh`: they **refuse to run** when
`NODE_ENV=production` or `VERCEL_ENV=production`, failing closed with a clear
message. They remain usable for ordinary local development.

## Pre-flight validation (no database contact)

Before deploying, run the preparation helper. It validates configuration
**without touching any database** — it never runs `db push`, `migrate reset`, or
the seed script:

```bash
chmod +x scripts/prepare-vercel.sh
./scripts/prepare-vercel.sh
```

It verifies: the PostgreSQL provider, that committed migrations exist, runs
`prisma generate` (safe), validates env-var documentation, and prints the exact
operator procedure.

## Production migrations

Migrations must run **exactly once per deployment**, not during every serverless
function startup. There are two supported ways to apply production migrations:

### Option A — automated (GitHub Actions CD)

`.github/workflows/cd.yml` includes a `migrate` job that runs
`prisma migrate deploy` on every push to `main`, **before** the Vercel deploy.
It:

- runs only on `push` to `main` (never on PR/preview CI);
- uses `prisma migrate deploy` (never `db push`);
- fails the deployment if migrations fail;
- never prints `DATABASE_URL`;
- does **not** auto-reset or recover destructively;
- does **not** seed.

**Required GitHub secret:** `PRODUCTION_DATABASE_URL` — the Neon **direct**
(non-pooled) connection string (DDL requires a direct connection; Neon's
transaction-mode pooler is incompatible with migration DDL).

If `PRODUCTION_DATABASE_URL` is **not** configured, the `migrate` job is
**skipped with a clear warning** (it does not invent a secret or fake success).
The operator must then run migrations manually (Option B).

### Option B — manual (operator)

Run migrations locally with the production `DATABASE_URL` **before** (or at)
deploy time:

```bash
DATABASE_URL='<Neon direct connection string>' bunx prisma migrate deploy
```

Never run `prisma migrate dev`, `prisma db push`, or `prisma migrate reset`
with a production `DATABASE_URL`.

## No automatic production seeding

Production deployment **never** seeds. The seed script (`prisma/seed.ts`) creates
an admin user and reference data — appropriate for local/test only. The
`db:seed` / `seed` scripts are guarded by `scripts/db-safety-guard.sh` and
refuse to run when production signals are present. Do **not** create default
production admin credentials as part of a deployment.

To seed a **local/dev** database explicitly:

```bash
# Local/dev only — the guard refuses this in production.
bun run db:seed
```

## Environment variables

Set these in Vercel (Project → Settings → Environment Variables → Production).
The full list with example values is in `.env.example`.

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string (runtime). |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `OTP_PEPPER` | `openssl rand -hex 32` (different from `JWT_SECRET`) |
| `CRON_SECRET` | `openssl rand -hex 32` (authenticates the external cron job) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Your SMTP provider |
| `MAIL_TRANSPORT` | `smtp` |

Generate secrets locally:

```bash
openssl rand -hex 32  # → JWT_SECRET
openssl rand -hex 32  # → OTP_PEPPER
openssl rand -hex 32  # → CRON_SECRET
```

## Deploy

```bash
vercel --prod
```

Or push to `main` — `.github/workflows/cd.yml` deploys via the Vercel CLI
(migrate job → build → deploy).

## Scheduled jobs — truth

`vercel.json` is intentionally `{}`. **Vercel Cron is not used.**

The one scheduled job is the webhook-queue processor, invoked by an **external**
cron service (e.g. cron-job.org):

- **Route:** `POST /api/webhooks/process-queue`
- **Method:** POST
- **Auth:** `CRON_SECRET` via `Authorization: Bearer <CRON_SECRET>` **or**
  `x-cron-secret: <CRON_SECRET>` header (constant-time compared)
- **Schedule:** every 1 minute (configured in the external cron service, not in
  this repository)

In production, `CRON_SECRET` **must** be set — the route refuses requests with
`500` when the secret is unset in production (it allows requests in dev for
local convenience). Do not add `vercel.json` cron configuration to make old
documentation true — the external-cron contract is the current, intentional
design.

## Health, liveness, readiness — semantics

The repository exposes several endpoints with distinct meanings. Do **not**
conflate them.

| Endpoint | Meaning | What it checks |
| --- | --- | --- |
| `GET /api/healthz` | **Process liveness** | Returns 200 if the process is up. No DB, no SMTP, no I/O. Cheapest check. |
| `GET /api/readyz` | **DB readiness** | Returns 200 (with `database: "ok"`) if `SELECT 1` succeeds; 503 otherwise. Does not check SMTP. |
| `GET /api/health` | **Application/service health** | DB (`SELECT 1`), SMTP **config presence** (not an SMTP transaction), Redis if configured. 503 if DB is down. |
| `GET /api/sandbox/health` | **Email renderer sandbox** | Verifies the server-side email renderer loads + renders a sample template to valid HTML. Not a DB/SMTP health check. |

Notes:
- `/api/health` SMTP check verifies **configuration values only** (`SMTP_USER`,
  `SMTP_PASS` are set) — it does **not** perform an SMTP transaction or prove
  real email-provider reachability.
- `/api/health` DB errors are sanitized to a bounded diagnostic category
  (`database_unreachable`, `database_connection_failed`, `database_auth_failed`,
  `database_error`) — the raw Prisma exception text is **never** exposed in the
  public response (it is logged server-side only). This prevents leaking
  hostnames, connection-string fragments, or credential-adjacent text.
- Public health responses use bounded, safe diagnostics. Server logs retain
  operational context but do not print secrets.

## Post-deployment verification checklist

Run these **non-destructive** checks against the canonical production origin
(`https://nixify.ir`). Do **not** send a real production OTP as part of
deployment verification — that remains an explicit operator action.

```bash
# Homepage responds
curl -sI https://nixify.ir/ | head -1

# Process liveness (cheapest)
curl -s https://nixify.ir/api/healthz

# DB readiness
curl -s https://nixify.ir/api/readyz

# robots.txt (crawl policy)
curl -s https://nixify.ir/robots.txt | head -3

# sitemap.xml (resolves + is valid XML)
curl -sI https://nixify.ir/sitemap.xml | head -1

# Public docs render
curl -sI https://nixify.ir/docs | head -1
```

A real OTP smoke test (send → verify) is an **explicit operator action**, not
part of automated deployment verification.

## Rollback

### Application rollback

Redeploy a known-good application commit/deployment:

```bash
# Revert the commit on main, then let CD redeploy, OR:
vercel --prod [previous-deployment-url]
```

### Database rollback

Do **not** attempt destructive automatic migration rollback. Prisma migrations
should be **forward-fixed** using a new committed migration unless the operator
has a separately validated database recovery procedure (e.g. a Neon
point-in-time restore performed by an operator with DBA authority).

Never use these as normal rollback mechanisms:

```text
prisma migrate reset
deleting production migration history
blindly reversing SQL
```

## Production safety guard

`scripts/db-safety-guard.sh` refuses destructive/dev Prisma commands when
production signals are present (`NODE_ENV=production` or
`VERCEL_ENV=production`). It is sourced by the `db:push`, `db:reset`,
`db:migrate`, `db:seed`, and `seed` npm scripts. It deliberately does **not**
infer production from the `DATABASE_URL` hostname (Neon is also used for
development/test databases). Local development is unaffected.

## Notes

- No Redis required — rate limiting uses DB-backed buckets.
- No long-running processes — all state is in PostgreSQL.
- Vercel free-tier limits and Neon free-tier storage are **pricing**, not
  permanent architecture facts — verify current quotas with the providers.
