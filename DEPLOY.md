# Nixify — Vercel Deployment Guide

This guide walks you through deploying Nixify to Vercel with a Neon PostgreSQL database.

## Prerequisites

1. **Vercel account** — [vercel.com](https://vercel.com) (free tier works)
2. **Neon database** — [neon.tech](https://neon.tech) (free tier: 3 GB storage, unlimited projects)
3. **Gmail account** — for SMTP email delivery (App Password required)
4. **Vercel CLI** — `npm i -g vercel`

## Step 1 — Create a Neon Database

1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project called "nixify"
3. Copy the **pooled connection string** (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`)
4. Save it — you'll need it for `DATABASE_URL`

## Step 2 — Prepare the Code

```bash
# Unzip the backup
unzip nixify-vercel-ready.zip -d nixify
cd nixify

# Install dependencies
bun install

# Run the Vercel prep script (flips Prisma to PostgreSQL)
chmod +x scripts/prepare-vercel.sh
./scripts/prepare-vercel.sh
```

The script will:
- Switch `prisma/schema.prisma` from `sqlite` to `postgresql`
- Verify your `DATABASE_URL` points to PostgreSQL
- Push the schema to your Neon database (creates all tables)
- Seed the database (admin user + disposable domain blocklist)

## Step 3 — Set Environment Variables in Vercel

Run `vercel` to link the project, then go to **Project Settings → Environment Variables** and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `postgresql://...neon.tech/dbname?sslmode=require` | From Neon dashboard |
| `JWT_SECRET` | `openssl rand -hex 32` | 32-char hex string |
| `OTP_PEPPER` | `openssl rand -hex 32` | Different from JWT_SECRET |
| `ADMIN_EMAIL` | `admin@yourdomain.com` | Admin login email |
| `ADMIN_PASSWORD` | `your-strong-password` | Admin login password |
| `SMTP_HOST` | `smtp.gmail.com` | |
| `SMTP_PORT` | `465` | |
| `SMTP_USER` | `your-email@gmail.com` | |
| `SMTP_PASS` | `your-16-char-app-password` | [Gmail App Password](https://myaccount.google.com/apppasswords) |
| `SMTP_FROM` | `Nixify <nixify@yourdomain.com>` | |
| `MAIL_TRANSPORT` | `smtp` | |
| `MAIL_REPLY_TO` | `support@yourdomain.com` | |
| `APP_NAME` | `Nixify` | |

Generate secrets locally:
```bash
openssl rand -hex 32  # → JWT_SECRET
openssl rand -hex 32  # → OTP_PEPPER
```

## Step 4 — Deploy

```bash
vercel --prod
```

Vercel will:
1. Install dependencies (triggers `postinstall` → `prisma generate`)
2. Build the Next.js app
3. Deploy serverless functions
4. Set up the cron jobs (webhook queue + sandbox health check)

## Step 5 — Verify the Deployment

```bash
# Health check (DB + SMTP)
curl https://your-app.vercel.app/api/health

# Sandbox/preview health check
curl https://your-app.vercel.app/api/sandbox/health

# API test (with your production API key)
curl -X POST https://your-app.vercel.app/api/v1/otp/send \
  -H "Authorization: Bearer mg_live_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@yourdomain.com","purpose":"signup"}'
```

## Step 6 — Post-Deploy Setup

1. **Visit your app** at `https://your-app.vercel.app`
2. **Sign up** a user account at `/auth`
3. **Admin login** at `/admin/login` (use `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
4. **Create an API key** at `/dashboard/api-keys`
5. **Test the full flow**: send OTP → check email → verify code

## Architecture on Vercel

```
Vercel (serverless functions)
├── Next.js App Router (API routes + pages)
├── Prisma Client → Neon PostgreSQL
├── Nodemailer → Gmail SMTP
├── Cron jobs (vercel.json):
│   ├── /api/webhooks/process-queue (every 1 min)
│   └── /api/sandbox/health (every 5 min)
└── Edge middleware (auth + role-based access control)
```

## Notes

- **No Redis required** — rate limiting uses DB-backed buckets (serverless-safe)
- **No long-running processes** — all state is in PostgreSQL
- **Cold starts** — the cron job pings `/api/sandbox/health` every 5 min to keep functions warm
- **Free tier limits** — Vercel Hobby: 100 GB bandwidth, 100 GB-hrs serverless execution; Neon free: 3 GB storage

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Prisma Client not found` | Ensure `postinstall` script ran (check Vercel build logs) |
| `Database connection error` | Verify `DATABASE_URL` has `?sslmode=require` |
| `Email not received` | Check Gmail App Password (not your regular password) |
| `401 on API calls` | Verify API key prefix: `mg_live_` for production |
| `Cron not running` | Vercel cron jobs require Pro plan for frequencies < 1 day |

## Rollback

```bash
# Redeploy a previous version
vercel --prod [previous-deployment-url]
```
