-- Phase 12: Persian Localization — user locale preference.
-- Adds a nullable `preferredLocale` column to `User`, constrained to the two
-- supported locale identifiers ('en', 'fa'). NULL means "no explicit preference
-- — use signal-based resolution (URL → cookie → Geo → Accept-Language → default)".
--
-- Prisma 6 has no first-class CHECK constraint DSL — this migration enforces it
-- at the DB level so application bugs (or direct SQL) cannot persist an
-- unsupported locale.
ALTER TABLE "User" ADD COLUMN "preferredLocale" TEXT;
ALTER TABLE "User"
  ADD CONSTRAINT "User_preferredLocale_check"
  CHECK ("preferredLocale" IS NULL OR "preferredLocale" IN ('en', 'fa'));
