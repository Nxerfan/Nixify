#!/usr/bin/env bash
#
# Nixify — Vercel production deployment PREPARATION helper (validation only).
#
# This script is a SAFE, non-destructive pre-flight check. It verifies the
# repository is configured for a Vercel + Neon (PostgreSQL) production deploy
# and explains the operator steps required. It does NOT touch any database.
#
# ─── What this script will NEVER do ──────────────────────────────────────────
#   - run `prisma db push`        (forbidden against production — see
#                                  docs/engineering/reliability-protocol.md §6.2)
#   - run `prisma migrate reset`  (destroys all data)
#   - run `prisma migrate dev`    (creates + applies migrations interactively)
#   - run the seed script         (production must never be auto-seeded — §6.3)
#   - modify production schema outside committed Prisma migrations
#   - print DATABASE_URL or any secret
#
# ─── What this script DOES ──────────────────────────────────────────────────
#   1. Verifies prisma/schema.prisma uses the PostgreSQL provider.
#   2. Verifies committed Prisma migrations exist (production schema evolution
#      is migration-based, not db-push based).
#   3. Runs `prisma generate` (safe — only generates the client, no DB contact).
#   4. Validates that required production env vars are documented in .env.example.
#   5. Prints the exact operator procedure for applying production migrations
#      (`prisma migrate deploy`) and configuring Vercel env vars.
#
# Usage:
#   chmod +x scripts/prepare-vercel.sh
#   ./scripts/prepare-vercel.sh
#
# Exit codes:
#   0 — all pre-flight checks passed; the operator may proceed to deploy
#   1 — a required configuration is missing or incorrect
#
set -euo pipefail

SCHEMA="prisma/schema.prisma"
MIGRATIONS_DIR="prisma/migrations"
ENV_EXAMPLE=".env.example"
cd "$(dirname "$0")/.."

echo "================================================"
echo "  Nixify — Vercel Production Preparation"
echo "  (validation + guidance — NO database contact)"
echo "================================================"
echo ""

# ─── 1. Verify Prisma provider is postgresql ────────────────────────────────
echo "[1/5] Checking Prisma provider..."
if grep -q 'provider = "postgresql"' "$SCHEMA"; then
  echo "      ✓ $SCHEMA uses PostgreSQL. No provider flip needed."
else
  echo "      ✗ $SCHEMA does NOT use PostgreSQL. Aborting."
  echo "        Edit prisma/schema.prisma and set provider = \"postgresql\"."
  exit 1
fi
echo ""

# ─── 2. Verify committed Prisma migrations exist ────────────────────────────
echo "[2/5] Checking committed Prisma migrations..."
if [ -d "$MIGRATIONS_DIR" ] && [ -n "$(ls -A "$MIGRATIONS_DIR" 2>/dev/null)" ]; then
  MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l)
  echo "      ✓ Found $MIGRATION_COUNT committed migration(s) in $MIGRATIONS_DIR."
  echo "        Production schema evolution MUST use 'prisma migrate deploy'."
  echo "        Never run 'prisma db push' or 'prisma migrate reset' against production."
else
  echo "      ✗ No committed Prisma migrations found in $MIGRATIONS_DIR."
  echo "        Production cannot be deployed without committed migrations."
  exit 1
fi
echo ""

# ─── 3. Generate Prisma client (safe — no DB contact) ──────────────────────
echo "[3/5] Generating Prisma client (prisma generate — no database contact)..."
if bunx prisma generate >/dev/null 2>&1; then
  echo "      ✓ Prisma client generated."
else
  echo "      ✗ prisma generate failed. Check prisma/schema.prisma syntax."
  exit 1
fi
echo ""

# ─── 4. Validate required env vars are documented in .env.example ──────────
echo "[4/5] Validating env-var documentation in $ENV_EXAMPLE..."
REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "OTP_PEPPER" "CRON_SECRET" "SMTP_HOST" "SMTP_USER" "SMTP_PASS" "SMTP_FROM" "MAIL_TRANSPORT")
MISSING_DOCS=()
for var in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "^${var}=" "$ENV_EXAMPLE" 2>/dev/null; then
    MISSING_DOCS+=("$var")
  fi
done
if [ ${#MISSING_DOCS[@]} -eq 0 ]; then
  echo "      ✓ All required env vars documented in $ENV_EXAMPLE."
else
  echo "      ✗ Missing from $ENV_EXAMPLE: ${MISSING_DOCS[*]}"
  exit 1
fi
echo ""

# ─── 5. Print the operator procedure ────────────────────────────────────────
echo "[5/5] Operator deployment procedure"
echo "      ─────────────────────────────────────────────────────────"
echo "      A. Apply production migrations BEFORE the first deploy, and on every"
echo "         release that includes a new committed migration:"
echo ""
echo "           DATABASE_URL='<Neon pooled connection string>' \\"
echo "           bunx prisma migrate deploy"
echo ""
echo "         (Run this locally with the production DATABASE_URL, OR via the"
echo "         GitHub Actions 'migrate' job in .github/workflows/cd.yml if the"
echo "         PRODUCTION_DATABASE_URL secret is configured — see DEPLOY.md.)"
echo ""
echo "      B. Set these env vars in Vercel (Project → Settings → Environment"
echo "         Variables → Production):"
echo "           DATABASE_URL     — Neon pooled connection string"
echo "           JWT_SECRET       — openssl rand -hex 32"
echo "           OTP_PEPPER       — openssl rand -hex 32  (different from JWT_SECRET)"
echo "           CRON_SECRET      — openssl rand -hex 32  (for the external cron job)"
echo "           SMTP_HOST/PORT/USER/PASS/FROM — your SMTP provider"
echo "           MAIL_TRANSPORT   — smtp"
echo ""
echo "      C. Deploy:"
echo "           vercel --prod"
echo "         (Or push to main — .github/workflows/cd.yml deploys via the Vercel CLI.)"
echo ""
echo "      D. Verify the deployment (non-destructive checks only):"
echo "           curl -s https://nixify.ir/api/healthz"
echo "           curl -s https://nixify.ir/api/readyz"
echo "           curl -s https://nixify.ir/robots.txt"
echo "           curl -s https://nixify.ir/sitemap.xml"
echo ""
echo "      E. Configure an EXTERNAL cron service (Vercel Cron is NOT used —"
echo "         vercel.json is intentionally empty) to hit:"
echo "           POST https://nixify.ir/api/webhooks/process-queue"
echo "           Headers: { 'x-cron-secret': '<CRON_SECRET>' }"
echo "           Schedule: every 1 minute"
echo ""
echo "================================================"
echo "  ✓ Pre-flight checks passed. Ready for the operator steps above."
echo "================================================"
