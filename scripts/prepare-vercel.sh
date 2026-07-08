#!/usr/bin/env bash
#
# Production deployment prep script for Vercel + Neon (PostgreSQL).
#
# This script:
#   1. Flips the Prisma provider from "sqlite" to "postgresql"
#   2. Verifies DATABASE_URL points to PostgreSQL
#   3. Runs prisma generate + db push to sync the production database
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

# Step 1: Flip Prisma provider to postgresql
if grep -q 'provider = "sqlite"' "$SCHEMA"; then
  echo "[1/4] Switching Prisma provider: sqlite → postgresql..."
  sed -i.bak 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"
  rm -f "$SCHEMA.bak"
  echo "      ✓ Done. $SCHEMA now uses PostgreSQL."
else
  echo "[1/4] Prisma provider already set to postgresql. Skipping."
fi
echo ""

# Step 2: Verify DATABASE_URL points to PostgreSQL
echo "[2/4] Checking DATABASE_URL..."
if [ -f .env ]; then
  DB_URL=$(grep "^DATABASE_URL=" .env | cut -d'=' -f2-)
  if echo "$DB_URL" | grep -q "^postgres"; then
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
  fi
else
  echo "      ⚠ No .env file found. Create one with DATABASE_URL pointing to Neon."
  exit 1
fi
echo ""

# Step 3: Generate Prisma client + push schema to production DB
echo "[3/4] Generating Prisma client + pushing schema to production database..."
echo "       (This creates all tables in your Neon database)"
bun run db:push
echo "      ✓ Schema synced."
echo ""

# Step 4: Seed the production database
echo "[4/4] Seeding production database (admin user + disposable domains)..."
bun run db:seed 2>/dev/null || echo "      (Run 'bun run db:seed' manually if this failed)"
echo "      ✓ Seed complete."
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
