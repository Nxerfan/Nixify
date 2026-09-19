# Nixify — Email OTP Verification API

Nixify is a hosted email OTP (one-time password) verification platform. You
generate an API key in the dashboard, hit our REST API to deliver 6-digit
codes, and verify the code your user types back. Hosted customers do **not**
provide any SMTP credentials — Nixify manages the mail transport end-to-end.

## Plans

| Plan  | API requests / month | OTP email sends / month | Price |
| ----- | -------------------- | ----------------------- | ----- |
| Free  | 1,000                | 100                     | $0    |
| Pro   | 50,000               | 10,000                  | paid  |
| Max   | unlimited            | unlimited               | paid  |

Nixify has separate API-request and OTP-email-send quotas. Their current
per-plan limits are defined by the canonical entitlement configuration.

No trial product. Nixify has no trial runtime. Commercial state is
`User.plan = FREE | PRO | MAX`. Legacy `trialStartedAt` / `trialExpiresAt`
database columns may physically exist for compatibility, but they are inert:
profile completion does not write them, APIs do not expose an active trial,
entitlements do not use them, and access does not depend on them.

## OTP engine

- 6-digit code from `crypto.randomInt` (rejection-sampled, no modulo bias).
- Stored as `HMAC-SHA256(OTP_PEPPER, code)` — never plaintext, never logged.
- Constant-time compare via `crypto.timingSafeEqual`.
- 10-minute TTL.
- Maximum 5 attempts per code, then 15-minute lockout on that code.
- **Atomic single-use** consume (`UPDATE ... WHERE consumedAt IS NULL`) so a
  code cannot validate twice, even under concurrent requests.

## Tech stack

| Concern    | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 16 (App Router) + TypeScript                |
| Database   | PostgreSQL (Neon for production; local Postgres for development) + Prisma ORM |
| Auth       | `jose` (JWT, edge-compatible) + `bcryptjs` (cost 12) |
| Validation | `zod`                                                |
| Tests      | Vitest                                              |

The Prisma `schema.prisma` declares `provider = "postgresql"`. There is no
SQLite path.

## Local setup

```bash
bun install
cp .env.example .env
# Generate strong secrets:
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # OTP_PEPPER
# Point DATABASE_URL at a local PostgreSQL instance.
bun run db:push
bun run dev
```

Open the app in the **Preview Panel** (right side of the interface). If you
are on the web UI, click **"Open in New Tab"** above the preview.

## API reference (v1)

Base URL (hosted): `https://nixify.vercel.app/api/v1`

All requests require a Bearer API key (`mg_test_…` for development,
`mg_live_…` for production). Create one in the dashboard at `/dashboard/api-keys`.
Test keys run in sandbox mode automatically (see [Sandbox](#sandbox-development-keys-only)
below) — no real email is sent and the OTP code is returned in the response body.

### POST /api/v1/otp/send

Issue + deliver a new OTP code.

```bash
curl -X POST https://nixify.vercel.app/api/v1/otp/send \
  -H "Authorization: Bearer mg_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","purpose":"signup"}'
```

```json
{
  "otp_request_id": "f3a2b1c8-...",
  "request_id": "a1b2c3d4-...",
  "expires_at": "2026-07-06T22:50:00.000Z",
  "message": "OTP sent",
  "code": "123456"
}
```

With a `mg_live_` key, Nixify emails the user a 6-digit code and the `code`
field is **not** present. With a `mg_test_` key (sandbox), no email is sent
and `code` contains the plaintext OTP so you can call `/verify` immediately.

### POST /api/v1/otp/verify

Verify the 6-digit code the user typed in.

```bash
curl -X POST https://nixify.vercel.app/api/v1/otp/verify \
  -H "Authorization: Bearer mg_test_xxx" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","code":"123456","purpose":"signup"}'
```

```json
{
  "verified": true,
  "otp_request_id": "f3a2b1c8-...",
  "request_id": "a1b2c3d4-..."
}
```

### POST /api/v1/otp/resend

Send a fresh code (same rate-limit + lockout rules as `/send`).

### Error envelope (consistent across all v1 routes)

```json
{
  "error": { "code": "rate_limited", "message": "Too many OTP sends. Retry in 47s.", "doc_url": "/docs#error-rate_limited" },
  "request_id": "a1b2c3d4-..."
}
```

The `doc_url` field points to a public anchor on the `/docs` page — no login
required. Common codes: `validation_failed`, `unauthorized`, `key_revoked`,
`key_expired`, `insufficient_scope`, `rate_limited`, `code_mismatch`, `expired`,
`already_used`, `locked`, `not_found`, `ip_blocked`, `quota_exceeded`,
`feature_not_available`, `internal_error`. See the full catalog at `/docs#errors`.

Note: error envelopes use `request_id` (the API trace ID matching the
`X-Request-Id` header). Success envelopes additionally include
`otp_request_id` (the OTP correlation ID of the OTP row that was issued /
consumed). These are distinct IDs and must not be conflated.

## Sandbox (development keys only)

`mg_test_` keys run in sandbox mode **automatically** — no header required.
OTPs are generated, hashed, and persisted exactly as in production, but no
real email is sent. The plaintext 6-digit code is returned in the `code`
field of the `/send` and `/resend` response so you can call `/verify`
immediately without an inbox. Test keys also skip the per-email rate limit
(3/min, 10/hour) so CI can run fast; the per-IP limit still applies.
User-owned test keys still consume the plan `API_MESSAGES` quota — only
system-owned keys (no user) skip it.

Optionally force a simulated error with the `X-Sandbox-Simulate` request
header (one of `rate_limited`, `locked`, `expired`, `mismatch`, `smtp_error`).
`mg_live_` keys cannot use sandbox mode — they always send real email.

## Webhooks

Register endpoint URLs in `/dashboard/webhooks`. Each delivery is signed
with HMAC-SHA256 and includes `Nixify-Signature` and `Nixify-Event` headers.
Events: `otp.sent`, `otp.verified`, `otp.failed`, `otp.expired`.

## Rate limits

- Per email — `/send`: 3 / minute, 10 / hour. (`mg_live_` keys only; test keys skip these.)
- Per IP — `/send`: 10 / minute, 60 / hour.
- Per IP — `/verify`: 30 / minute, 120 / hour.

Response headers: every response includes `X-Request-Id` (matches the body
`request_id`) and `X-Api-Version: 1`. Successful (2xx) responses include
`X-Quota-Remaining`. IP-level and email-level 429 responses include a
`Retry-After` header (seconds); email-level 429s additionally include
`X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`.
Plan-quota 429s (the per-minute plan rate limit, returned as `rate_limited`
from the entitlement engine) include `X-RateLimit-Reset` and
`X-Quota-Remaining` — they do **not** include `Retry-After`.

## Project structure

```
src/
  app/
    api/v1/otp/{send,verify,resend}/route.ts   # v1 OTP API
    api/v1/{contacts,groups,events,...}         # v1 product APIs
    api/admin/...                                # admin routes
    api/auth/...                                 # first-party web auth
    api/dashboard/...                            # dashboard routes
    dashboard/...                                # dashboard pages
    profile/, signup/, login/, verify-email/    # web-auth pages
    privacy/, terms/, pricing/, blog/            # public pages
  components/                                    # shadcn/ui + site components
  lib/
    otp/{generator,verifier}.ts                  # OTP engine
    dx/                                          # v1 API request context, API keys, webhooks
    entitlements/                                # plan/quota engine
    security/                                    # IP/device/disposable/lockout rules
    db.ts                                        # Prisma client
  middleware.ts                                  # page-level auth guard (Edge)
prisma/schema.prisma                            # PostgreSQL schema
```

## Testing

```bash
bunx vitest run
```

## Operator / deployment notes

Nixify is a hosted service. Operator-side SMTP configuration (when self-hosting
a fork) is a deployment concern and is separate from the hosted API contract —
hosted API customers do not provide any SMTP credentials.
