# MailGuard — Real OTP Email Verification Service

A **real, working** one-time-password email verification service. No mocks, no
third-party OTP/email/auth APIs, $0/month. It sends genuine 6-digit codes over
real SMTP (Gmail + App Password), verifies them with a proper OTP engine, and
grants a 1-month free trial the moment a user completes their profile.

The mail transport is **swappable by configuration only**: today it targets
Gmail SMTP (Architecture A), and moving to a self-hosted Postfix relay
(Architecture C) later changes **zero application code** — only environment
variables. See [`docs/UPGRADE-TO-SELFHOSTED.md`](docs/UPGRADE-TO-SELFHOSTED.md).

---

## Features

- **Real email delivery** via Gmail SMTP (Nodemailer, STARTTLS on port 587, App
  Password auth). No stub transport in the shipped code path.
- **Proper OTP engine** (doc Phase 10):
  - 6-digit code from `crypto.randomInt` (rejection-sampled, no modulo bias)
  - Stored as `HMAC-SHA256(OTP_PEPPER, code)` — **never** plaintext
  - Constant-time compare via `crypto.timingSafeEqual`
  - 10-minute TTL, max 5 attempts, then 15-minute lockout
  - **Atomic single-use** consume (`UPDATE ... WHERE consumedAt IS NULL`) so a
    code can't validate twice, even under concurrent requests
- **Serverless-safe**: all rate limiting & attempt counters live in the database
  (no in-memory state). Survives stateless Vercel function invocations.
- **Rate limiting** (DB-backed): 3 sends/min & 10/hour per email; 5 verifies/min.
- **Auth**: JWT in an `httpOnly`/`secure`/`sameSite=lax` cookie (signed with
  `jose`, 7-day expiry, re-issued on login). Passwords hashed with `bcryptjs`
  (cost factor 12).
- **Password reset** flow via the same OTP engine (`purpose: 'reset'`).
- **1-month free trial** activated on profile completion; status computed at
  request time from `trialExpiresAt`.
- **Page-level auth guard** (`middleware.ts`) for `/profile` and `/dashboard` —
  UX convenience; every API route still verifies the JWT server-side.

## Tech stack

| Concern        | Choice                                                   |
| -------------- | -------------------------------------------------------- |
| Framework      | Next.js 16 (App Router) + TypeScript                     |
| Database       | SQLite (local) / PostgreSQL via Neon (prod) + Prisma ORM |
| Mail           | Nodemailer, Gmail SMTP (Architecture A)                  |
| Auth           | `jose` (JWT, edge-compatible) + `bcryptjs` (cost 12)     |
| Validation     | `zod`                                                     |
| Tests          | Vitest                                                    |

> **Note on the database provider.** The repo ships configured for **SQLite**
> so it runs with zero setup in this environment. The schema (`Int` autoincrement
> IDs, `Bytes` for the OTP hash, `@default(now())`, `@default(uuid())`) is valid
> unchanged for PostgreSQL — to deploy to Neon, change
> `provider = "sqlite"` → `"postgresql"` in `prisma/schema.prisma` and set
> `DATABASE_URL` to your Neon pooled string. Section
> [Production (Neon + Vercel)](#production-neon--vercel) covers this.

---

## Local setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Generate strong secrets (paste the output into `.env`):

```bash
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # OTP_PEPPER
```

**For local dev without SMTP credentials**, set `MAIL_TRANSPORT=console` in
`.env`. This is a dev-only transport that prints the email (including the OTP
code) to the server terminal so you can complete the flow end-to-end. It is
**not** a fake OTP — the code is genuinely generated, HMAC-hashed, and stored
exactly as in production; only the last-mile delivery goes to stdout. It
refuses to run when `NODE_ENV=production`.

**For real email delivery locally**, set:

```
MAIL_TRANSPORT=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.address@gmail.com
SMTP_PASS=your_16_char_app_password   # NOT your Gmail password — an App Password
SMTP_FROM="MailGuard <your.address@gmail.com>"
```

Create a Gmail App Password: Google Account → Security → 2-Step Verification →
App passwords → generate a 16-character password.

### 3. Create the database

```bash
bun run db:push      # SQLite: creates tables from schema.prisma
```

(For a PostgreSQL target you would run `npx prisma migrate dev --name init`
using the **unpooled/direct** connection string — see below.)

### 4. Run the dev server

```bash
bun run dev
```

Open the app in the **Preview Panel** (right side of the interface). If you're
on the web UI, click **"Open in New Tab"** above the preview.

---

## Walkthrough: signup → OTP email → verify → login → profile → trial

> If `MAIL_TRANSPORT=console`, the 6-digit code is printed to the terminal
> running `bun run dev` (and to `dev.log`). If `MAIL_TRANSPORT=gmail`, it lands
> in the recipient's real Gmail inbox.

### Browser walkthrough

1. **Landing** (`/`) → click **"Get started — free"** → `/signup`.
2. Enter email + password (≥ 8 chars) → **Create account**.
   - Backend creates an unverified `User` and emails a 6-digit OTP
     (`purpose: 'signup'`).
3. You're redirected to `/verify-email?email=…`. Enter the 6-digit code from
   your inbox (or terminal, in console mode) → **Verify**.
   - Backend constant-time-verifies the HMAC, atomically marks the code
     consumed, sets `emailVerified = true`, and sets the session cookie.
4. Redirected to `/profile`. Enter **full name** + **phone number** → **Save &
   start trial**.
   - Backend validates the phone (E.164-ish), sets `profileCompleted = true`,
     `trialStartedAt = now`, `trialExpiresAt = now + 30 days`.
5. Redirected to `/dashboard`. You see the **Active** trial badge, days
   remaining, and a progress bar.

### curl walkthrough

```bash
BASE=http://localhost:3000

# 1. Signup (creates unverified user, sends OTP)
curl -i -c cookies.txt -X POST "$BASE/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"supersecret"}'
# → 201 {"message":"Verification code sent..."}

# 2. (Read the 6-digit code from your inbox / terminal.)

# 3. Verify the code (sets the auth cookie)
curl -i -b cookies.txt -c cookies.txt -X POST "$BASE/api/auth/verify-email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","code":"123456"}'
# → 200 {"message":"Email verified. Welcome!"}

# 4. Complete the profile (activates trial)
curl -i -b cookies.txt -X POST "$BASE/api/profile/complete" \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Ada Lovelace","phoneNumber":"+14155550100"}'
# → 200 {"message":"Profile completed...","trial":{"active":true,...}}

# 5. Check trial status
curl -i -b cookies.txt "$BASE/api/profile/me"
# → 200 {"user":{...},"trial":{"active":true,"daysRemaining":30,...}}

# 6. Logout
curl -i -b cookies.txt -c cookies.txt -X POST "$BASE/api/auth/logout"
```

Other endpoints: `POST /api/auth/login`, `POST /api/auth/resend-otp`
(`{email,purpose}`), `POST /api/auth/forgot-password` (`{email}` — always 200),
`POST /api/auth/reset-password` (`{email,code,newPassword}`),
`GET /api/healthz`, `GET /api/readyz`.

---

## API reference

| Method | Path                       | Auth | Body                                | Notes                                              |
| ------ | -------------------------- | ---- | ----------------------------------- | -------------------------------------------------- |
| POST   | `/api/auth/signup`         | —    | `{email,password}`                  | Creates unverified user, sends signup OTP          |
| POST   | `/api/auth/verify-email`   | —    | `{email,code}`                      | Verifies OTP, sets cookie                          |
| POST   | `/api/auth/login`          | —    | `{email,password}`                  | Requires `emailVerified`; sets cookie              |
| POST   | `/api/auth/resend-otp`     | —    | `{email,purpose}`                   | purpose ∈ `signup` \| `login` \| `reset`           |
| POST   | `/api/auth/logout`         | —    | —                                   | Clears cookie                                      |
| POST   | `/api/auth/forgot-password`| —    | `{email}`                           | Always 200; sends reset OTP if account exists      |
| POST   | `/api/auth/reset-password` | —    | `{email,code,newPassword}`          | Verifies reset OTP, updates password hash          |
| POST   | `/api/profile/complete`    | ✅   | `{fullName,phoneNumber}`            | Activates the 1-month trial                        |
| GET    | `/api/profile/me`          | ✅   | —                                   | Profile + computed trial status                    |
| GET    | `/api/healthz`             | —    | —                                   | 200 if process up                                  |
| GET    | `/api/readyz`              | —    | —                                   | 200 if DB reachable (`SELECT 1`)                   |

**Error shape** (consistent, §13.7): `{ "error": "<short_code>", "message": "<human readable>" }`.
Short codes: `validation_failed`, `rate_limited`, `locked`, `code_mismatch`,
`expired`, `already_used`, `unauthorized`, `email_exists`, `email_not_verified`,
`invalid_credentials`, `not_found`, `profile_incomplete`, `internal_error`.

---

## Security rules (doc §10, §13)

- OTP codes are **never** stored or logged in plaintext — only
  `HMAC-SHA256(OTP_PEPPER, code)`.
- Comparison is constant-time (`crypto.timingSafeEqual`).
- Every verify attempt increments `attempts` (match or not). After 5, the code
  is `locked` for 15 minutes.
- Single-use is enforced atomically at the database
  (`UPDATE ... WHERE consumedAt IS NULL`) — concurrent requests can't double-spend.
- Passwords hashed with `bcryptjs` cost 12. Raw passwords are never logged.
- Raw phone numbers are never logged.
- The JWT cookie is `httpOnly`, `secure`, `sameSite=lax`, `path=/`, 7-day expiry.
- `forgot-password` always returns 200 to avoid account enumeration.
- Middleware guards pages for UX; **API routes are the security boundary** and
  independently verify the JWT.

---

## Production (Neon + Vercel)

### Database: use the **pooled** connection string at runtime (§13.1)

Neon exposes two connection strings. Using the wrong one exhausts Neon's
connection limit under concurrent Vercel invocations.

| String                  | Hostname contains   | Use for                          |
| ----------------------- | ------------------- | -------------------------------- |
| **Pooled** (PgBouncer)  | `-pooler`           | `DATABASE_URL` at **runtime**    |
| **Direct** (unpooled)   | (no `-pooler`)      | `DIRECT_URL` for **migrations** only |

On Vercel, set these environment variables (Project Settings → Environment
Variables):

```
DATABASE_URL=postgres://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?pgbouncer=true&connection_limit=1
DIRECT_URL=postgres://user:pass@ep-xxx.region.aws.neon.tech/neondb
```

Switch the Prisma provider to PostgreSQL in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Run migrations locally with the **direct** URL, then deploy. (On Vercel, the
build runs `prisma generate`; run `prisma migrate deploy` in your CI/release
step or once locally against the direct URL.)

### Mail

Set `MAIL_TRANSPORT=gmail` (or leave unset — gmail is the default) and the
`SMTP_*` variables to your Gmail App Password. **Never** set
`MAIL_TRANSPORT=console` on Vercel.

### Deploy

```bash
vercel
```

All API routes declare `export const runtime = "nodejs"` (Nodemailer/bcrypt are
Node-only). The middleware (JWT check) is Edge-compatible.

---

## Testing

```bash
bunx vitest run
```

Unit tests (`src/lib/otp/otp.test.ts`) cover the OTP engine: code generation
format, HMAC determinism, constant-time compare (true/false/length-mismatch),
and the pure decision function `decideOtp` for `valid` / `mismatch` / `expired`
/ `locked` / `already_used` (single-use enforcement & lockout after 5 attempts).

Per §13.5, tests inject a fake `MailTransport` via dependency injection rather
than flipping an env var inside the transport — there is no risk of the fake
running in production.

---

## Project structure

```
src/
  app/
    page.tsx                      # landing
    signup/page.tsx
    verify-email/page.tsx
    login/page.tsx
    forgot-password/page.tsx
    reset-password/page.tsx
    profile/page.tsx
    dashboard/page.tsx
    api/
      auth/{signup,verify-email,login,resend-otp,logout,forgot-password,reset-password}/route.ts
      profile/{complete,me}/route.ts
      healthz/route.ts
      readyz/route.ts
  components/
    site-header.tsx
    site-footer.tsx
    ui/                           # shadcn/ui (existing)
  lib/
    mail/transport.ts             # MailTransport interface + Gmail/Console impls + factory
    otp/generator.ts              # generateOtpCode, hashOtpCode, constantTimeVerify
    otp/verifier.ts               # issueOtp, consumeOtp (atomic single-use), decideOtp
    auth/jwt.ts                   # jose sign/verify (edge-compatible)
    auth/password.ts              # bcryptjs cost 12
    auth/session.ts               # httpOnly cookie get/set/clear
    ratelimit.ts                  # DB-backed rate limiting
    api-response.ts               # consistent error shape
    http.ts                       # parseBody + zod
    validation.ts                 # zod schemas
    db.ts                         # Prisma client
  middleware.ts                   # page-level auth guard (Edge)
prisma/schema.prisma
docs/UPGRADE-TO-SELFHOSTED.md
.env.example
README.md
```
