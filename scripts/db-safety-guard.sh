#!/usr/bin/env bash
#
# Nixify database safety guard.
#
# Refuses destructive / dev-only Prisma commands when clear production signals
# are present. Fail-closed with a clear message.
#
# Production signals (any one triggers the guard):
#   - NODE_ENV=production
#   - VERCEL_ENV=production
#
# Deliberately does NOT infer production from the DATABASE_URL hostname, because
# Neon (and other managed Postgres) is routinely used for development and test
# databases too — a Neon hostname is NOT proof of production.
#
# Usage (sourced by other scripts, or run directly to check the current env):
#   source scripts/db-safety-guard.sh        # exits the caller on violation
#   bash scripts/db-safety-guard.sh         # standalone check
#
# The guard takes the intended command as $1 when sourced with an argument, so
# callers can name the forbidden operation in the error message:
#   source scripts/db-safety-guard.sh "prisma db push"
#
# Allowed (non-destructive) production commands are NOT blocked:
#   - prisma generate
#   - prisma migrate deploy      (the ONLY production schema-evolution path)
#   - prisma migrate status
#   - prisma validate
#   - prisma studio (read-only browsing is operator-driven, not a deploy step)
#
# Forbidden in production (blocked by this guard):
#   - prisma db push              (schema drift, no migration record)
#   - prisma migrate reset        (destroys all data)
#   - prisma migrate dev          (creates + applies migrations interactively)
#   - prisma db seed              (no automatic production seeding — see
#                                  docs/engineering/reliability-protocol.md §6)
#
set -euo pipefail

# The command the caller intends to run (for a clearer error message).
# Empty when run standalone (just reports the environment verdict).
INTENDED="${1:-}"

is_production() {
  [ "${NODE_ENV:-}" = "production" ] || [ "${VERCEL_ENV:-}" = "production" ]
}

# When sourced by another script, $0 is the sourcing script and BASH_SOURCE[0]
# is this file. Detect "run directly" vs "sourced".
if [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then
  # Run directly — just report the verdict.
  if is_production; then
    echo "db-safety-guard: PRODUCTION environment detected (NODE_ENV=${NODE_ENV:-unset}, VERCEL_ENV=${VERCEL_ENV:-unset})."
    echo "  Destructive/dev Prisma commands (db push, migrate reset, migrate dev, db seed) are REFUSED."
    exit 0
  else
    echo "db-safety-guard: non-production environment. Destructive commands are allowed locally."
    exit 0
  fi
fi

# Sourced — enforce.
if is_production; then
  echo "❌ db-safety-guard: REFUSING to run '${INTENDED:-<command>}' in a PRODUCTION environment." >&2
  echo "   NODE_ENV=${NODE_ENV:-unset}, VERCEL_ENV=${VERCEL_ENV:-unset}." >&2
  echo "" >&2
  echo "   Production schema evolution MUST use committed Prisma migrations via" >&2
  echo "   'prisma migrate deploy' (see DEPLOY.md and" >&2
  echo "   docs/engineering/reliability-protocol.md §6)." >&2
  echo "" >&2
  echo "   Forbidden in production:" >&2
  echo "     - prisma db push       (no migration record, schema drift)" >&2
  echo "     - prisma migrate reset (destroys all data)" >&2
  echo "     - prisma migrate dev   (interactive migration creation)" >&2
  echo "     - prisma db seed       (no automatic production seeding)" >&2
  exit 1
fi
