# Incident Response Runbook — Nixify

This runbook describes the **actual** operational tooling available for
investigating Nixify production incidents. It lists only what is genuinely
implemented — no alerting, PagerDuty, Sentry, Axiom, Logtail, or uptime
monitoring is integrated unless explicitly stated.

## What Nixify implements

- **Structured JSON logging** to stdout/stderr (captured by the Vercel
  runtime). See `src/lib/logger.ts`. Logs are emitted **immediately** (no
  buffer/timer) and are correlated by a server-generated `requestId`.
- **Centralized redaction** (`src/lib/log-sanitizer.ts`) — sensitive keys
  (authorization, cookie, password, secret, token, apiKey, otp, code,
  DATABASE_URL, etc.) are recursively replaced with `[REDACTED]` before any
  log line is written, in both production and development.
- **Safe error serialization** — `Error` objects are logged as a bounded
  `{name, diagnostic, prismaCode?}` rep, never `err.message` or stack.
- **`RequestLog` audit table** — every v1 API request is recorded (best-effort)
  with `requestId`, `apiKeyId`, `userId`, `environment`, `method`, `path`,
  `status`, `durationMs`, `ip`, `userAgent`. This is tenant-scoped audit data,
  distinct from application logs.
- **Health endpoints** (see below).

## What Nixify does NOT implement

Nixify does **not** integrate with:

- **PagerDuty** — no alerting integration.
- **Sentry** — no error-monitoring vendor.
- **Axiom / Logtail** — the previous bespoke HTTP shipper was removed; no
  third-party log drain is configured by the application. An operator may drain
  Vercel's captured stdout/stderr to such a service externally.
- **Uptime monitoring** — no automated uptime checker is configured by the
  application. An operator may point an external uptime service (e.g.
  UptimeRobot) at `/api/healthz`.

If any of these are needed, they are an **operator** configuration, not an
application code change.

## Investigation procedure

### 1. Start from a user-visible `request_id`

Every v1 API response includes:

- an `X-Request-Id` response header;
- a `request_id` field in the JSON body.

Web (dashboard) requests do not currently surface a request ID to the user; if
a dashboard issue is reported, ask the user for the approximate timestamp and
the page/URL they were on.

### 2. Search the `RequestLog` table

Connect to the production database (Neon) and query the audit log:

```sql
SELECT "requestId", method, path, status, "durationMs", ip, "userAgent", error, "createdAt"
FROM "RequestLog"
WHERE "requestId" = '<the request_id>';
```

This tells you the HTTP status, duration, path, and whether the request was
flagged as an error. `RequestLog` is tenant-scoped via `apiKeyId` / `userId`.

### 3. Correlate with runtime logs

In the Vercel dashboard, filter the deployment's runtime logs (stdout/stderr)
by the `requestId`. Every v1 application log line emitted during that request
carries the same `requestId` in its structured JSON:

```json
{"level":"error","message":"v1_request_failed","requestId":"req_...","component":"v1_api",...}
```

Structured fields to look for:

- `requestId` — correlates with the `RequestLog` row and the user's
  `X-Request-Id`.
- `component` — e.g. `v1_api`, `health`, `readyz`.
- `diagnostic` — a bounded category (e.g. `database_unreachable`,
  `database_auth_failed`, `network_error`, `timeout`).
- `prismaCode` — a safe Prisma error code (e.g. `P1001`) if the failure was a
  Prisma error.
- `apiKeyId`, `userId` — safe operational identifiers.

The raw exception message, stack trace, hostname, username, and password are
**never** in the logs — they are redacted or replaced by bounded diagnostics.

### 4. Check health endpoints

| Endpoint | What it tells you |
| --- | --- |
| `GET /api/healthz` | Process liveness (200 if the process is up; no DB, no I/O). Cheapest check. |
| `GET /api/readyz` | DB readiness (200 if `SELECT 1` succeeds; 503 otherwise). |
| `GET /api/health` | Application/service health (DB + SMTP **config presence** + Redis if configured). 503 if DB is down. |

Limitations:

- `/api/health` SMTP check verifies **configuration values only** (`SMTP_USER`,
  `SMTP_PASS` are set) — it does **not** perform an SMTP transaction or prove
  real email-provider reachability.
- `/api/health` DB errors are sanitized to a bounded diagnostic category
  (`database_unreachable`, `database_connection_failed`, `database_auth_failed`,
  `database_error`) — the raw exception is not exposed publicly or in logs.

### 5. Identify the failure domain

- **Application error** (500 `internal_error`): look for a `v1_request_failed`
  structured log with `component: "v1_api"` and the same `requestId`. The
  `diagnostic` field tells you the category.
- **DB readiness**: `/api/readyz` returns 503; `diagnostic` is
  `database_unreachable` / `database_connection_failed` / `database_auth_failed`.
- **Email configuration**: `/api/health` SMTP status is `degraded`; the SMTP
  config env vars may be missing or the provider unreachable (the health check
  cannot distinguish — verify SMTP credentials manually).
- **Webhook processing**: if webhooks are not being delivered, check the
  external cron service is still hitting `POST /api/webhooks/process-queue`
  with the correct `CRON_SECRET`. The route refuses requests in production when
  `CRON_SECRET` is unset.

### 6. Inspect a specific deployment/commit

Every Vercel deployment is tied to a Git commit SHA. In the Vercel dashboard,
find the deployment and note the commit. To inspect the code at that commit:

```bash
git fetch origin
git checkout <commit-sha>
```

To compare what changed between the last known-good deployment and the current
one:

```bash
git log --oneline <known-good-sha>..<current-sha>
git diff <known-good-sha>..<current-sha> -- src/lib/
```

### 7. Escalate without changing production data

- **Application rollback**: redeploy a known-good commit (see `DEPLOY.md` →
  Rollback). This does NOT touch the database.
- **Database**: do NOT run `prisma migrate reset`, delete migration history, or
  blindly reverse SQL. Forward-fix via a new committed migration if a schema
  issue is the cause. A Neon point-in-time restore is an operator/DBA action
  performed via the Neon dashboard, not via application code.
- **Secrets**: never paste `DATABASE_URL`, API keys, OTP codes, cookies, or
  `CRON_SECRET` into incident notes, chat, or tickets. Rotate a compromised
  secret in the Vercel/GitHub dashboard if exposure is suspected.

## Never do during an incident

- Paste secrets, API keys, OTP codes, cookies, or DB URLs into incident notes.
- Run `prisma db push`, `prisma migrate reset`, or `prisma migrate dev`
  against production (the `db-safety-guard.sh` refuses these in production
  anyway).
- Delete production migration history.
- Blindly reverse SQL without a separately validated recovery procedure.
- Disable the centralized redaction to "see the raw error" — the bounded
  `diagnostic` + `prismaCode` categories are sufficient for triage; if more
  detail is needed, reproduce locally with a dev database.

## Logging safety contract (reference)

- All metadata passes through the recursive redactor before output.
- `Error` objects serialize to `{name, diagnostic, prismaCode?}` — never
  `err.message`, never stack, never host/user/password.
- The logger never throws (circular refs, BigInt, throwing getters are handled).
- The same redaction applies in development.
- Public health responses use bounded diagnostics only.
