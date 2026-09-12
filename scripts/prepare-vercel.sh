#!/usr/bin/env bash
#
# Production deployment prep script for Vercel + Neon (PostgreSQL).
#
# The Prisma schema is already configured for PostgreSQL (provider =
# "postgresql"). This script:
#   1. Verifies DATABASE_URL points to PostgreSQL
#   2. Runs prisma generate + db push to sync the production database
#   3. Seeds the production database
#   4. Lists the env vars you need to set in Vercel
#
# Usage:
#   chmod +x scripts/prepare-vercel.sh
#   ./scripts/prepare-vercel.sh
#
set -euo pipefail

SCHEMA="prisma/schema.prisma"
cd "$(dirname "$0")/.."

echo "================================================"
echo "  Nixify — Vercel Production Preparation"
echo "================================================"
echo ""

# Step 1: Verify the Prisma provider is postgresql (sanity check).
echo "[1/3] Checking Prisma provider..."
if grep -q 'provider = "postgresql"' "$SCHEMA"; then
  echo "      ✓ $SCHEMA uses PostgreSQL. No flip needed."
else
  echo "      ✗ $SCHEMA does NOT use PostgreSQL. Aborting."
  echo "        Edit prisma/schema.prisma and set provider = \"postgresql\"."
  exit 1
fi
echo ""

# Step 2: Verify DATABASE_URL points to PostgreSQL.
echo "[2/3] Checking DATABASE_URL..."
if [ -f .env ]; then
  DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2-)
  if echo "$DB_URL" | grep -qE "^postgres(ql)?://"; then
    echo "      ✓ DATABASE_URL starts with postgres:// — looks like PostgreSQL."
  elif echo "$DB_URL" | grep -q "^file:"; then
    echo "      ⚠ DATABASE_URL points to a file (SQLite)."
    echo "        For Vercel, set DATABASE_URL to your Neon connection string:"
    echo "        postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
    echo ""
    echo "        Get a free Neon database at: https://neon.tech"
    exit 1
  else
    echo "      ⚠ DATABASE_URL format unclear. Verify it's a PostgreSQL connection string."
    exit 1
  fi
else
  echo "      ⚠ No .env file found. Create one with DATABASE_URL pointing to Neon."
  exit 1
fi
echo ""

# Step 3: Generate Prisma client + push schema to production DB + seed.
echo "[3/3] Generating Prisma client + pushing schema + seeding..."
bun run db:push
bun run db:seed 2>/dev/null || echo "      (Run 'bun run db:seed' manually if this failed)"
echo "      ✓ Database synced + seeded."
echo ""

echo "================================================"
echo "  ✓ Production database ready!"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Set these env vars in Vercel (Project → Settings → Environment Variables):"
echo ""
echo "     DATABASE_URL     = your Neon connection string"
echo "     JWT_SECRET       = a 32+ char random hex string (openssl rand -hex 32)"
echo "     OTP_PEPPER       = a 32+ char random hex string (openssl rand -hex 32)"
echo "     ADMIN_EMAIL      = your admin login email"
echo "     ADMIN_PASSWORD   = your admin login password"
echo "     CRON_SECRET      = a 32+ char random hex string (for webhook queue cron)"
echo "     SMTP_HOST        = smtp.gmail.com"
echo "     SMTP_PORT        = 465"
echo "     SMTP_USER        = your Gmail address"
echo "     SMTP_PASS        = your Gmail App Password (16 chars)"
echo "     SMTP_FROM        = Nixify <nixify@yourdomain.com>"
echo "     MAIL_TRANSPORT   = smtp"
echo "     MAIL_REPLY_TO    = support@yourdomain.com"
echo "     APP_NAME         = Nixify"
echo ""
echo "  2. Deploy to Vercel:"
echo "     vercel --prod"
echo ""
echo "  3. After deploy, test:"
echo "     curl https://your-app.vercel.app/api/health"
echo "     curl https://your-app.vercel.app/api/sandbox/health"
echo ""
echo "  4. Configure your external cron service (cron-job.org) to hit:"
echo "     POST https://your-app.vercel.app/api/webhooks/process-queue"
echo "     Headers: { 'x-cron-secret': '<CRON_SECRET>' }"
echo "     Schedule: every 1 minute"
echo ""
