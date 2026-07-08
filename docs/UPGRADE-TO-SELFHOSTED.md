# Upgrading to a Self-Hosted Postfix Relay (Architecture C)

This document explains how to move MailGuard from **Architecture A** (Gmail SMTP)
to **Architecture C** (self-hosted Postfix relay, doc Phase 7) — with **zero
application code changes**.

## Why it's a config-only change

The application never talks to SMTP directly. It talks to the `MailTransport`
interface in `src/lib/mail/transport.ts`:

```ts
export interface MailTransport {
  send(message: MailMessage): Promise<{ messageId: string }>;
}
```

`GmailSmtpTransport` (the production default) reads **every** connection detail
from environment variables — nothing is hardcoded:

```ts
host = process.env.SMTP_HOST        // "smtp.gmail.com" today, "mail.yourdomain.com" tomorrow
port = Number(process.env.SMTP_PORT) // 587
user = process.env.SMTP_USER
pass = process.env.SMTP_PASS
from = process.env.SMTP_FROM
```

So the *exact same code* that delivers via Gmail today will deliver via your
Postfix relay tomorrow once you point the env vars at it. The OTP engine
(`src/lib/otp/*`), the rate limiter, the auth layer, and every route handler
are completely transport-agnostic.

## Steps

### 1. Stand up your Postfix relay (doc Phase 7)

A minimal, deliverable Postfix relay on a VPS (port 25 inbound from the
internet is required for delivery to other MXes; 587 is for your app to submit
to it). High level:

- Install Postfix. Configure it as an **internet-facing SMTP relay** that
  accepts submissions from your app on port 587 (STARTTLS) or 465 (implicit
  TLS) with SMTP AUTH.
- Set up PTR (reverse DNS), SPF, DKIM (sign outgoing mail), and DMARC so
  recipient providers don't junk your mail.
- Create an SMTP AUTH credential for your app (e.g. `mailguard` / a strong
  password).

### 2. Point Vercel env vars at your relay

In Vercel → Project Settings → Environment Variables, change:

```
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587                 # or 465 for implicit TLS
SMTP_USER=mailguard@yourdomain.com
SMTP_PASS=<strong password you set in Postfix SASL>
SMTP_FROM="MailGuard <noreply@yourdomain.com>"
MAIL_TRANSPORT=gmail          # leave as the real-transport default (the name is historical;
                              # it means "use SMTP_* over a real SMTP server")
```

Redeploy. That's it — the same `GmailSmtpTransport` now speaks STARTTLS to your
Postfix box.

> The class is named `GmailSmtpTransport` for historical reasons (Architecture A
  shipped first). It is a generic SMTP client. If you prefer, rename it to
  `SmtpTransport` — a pure refactor with no behavior change. The
  `MailTransport` interface is the contract that matters.

### 3. (Optional) Add a dedicated transport class

If you later want transport-specific behavior (e.g. Postfix connection pooling,
a local pickup-directory transport for tests), add a new class implementing
`MailTransport` and select it in `createMailTransport()`. The rest of the app
is unaffected because it depends on the interface, not the implementation.

## What does NOT change

- `src/lib/otp/*` — OTP generation, HMAC hashing, constant-time verify, atomic
  single-use consume, lockout, rate limiting.
- `src/lib/auth/*` — JWT, bcrypt, session cookie.
- All route handlers under `src/app/api/`.
- The database schema.
- The frontend.

## Capacity notes (doc §9.1 "upgrade path")

Gmail SMTP caps outbound at ~500/day per account and is intended for low-volume
transactional mail. A self-hosted Postfix relay on a modest VPS with proper
DNS hygiene (PTR/SPF/DKIM/DMARC) and warm IP reputation handles substantially
higher volume and gives you full control over delivery, retries, and bounces.
Because the OTP engine is identical across architectures, you can migrate at
any time without touching the security-critical code path.
