-- ============================================================================
-- Phase 19: Developer Onboarding Progress
-- ============================================================================
-- Adds the OnboardingProgress table — one row per user (1:1 via unique
-- userId) tracking first-time developer onboarding completion.
--
-- Step flags are set ONLY when the real precondition is verified server-side:
--   • stepApiKeyCreated   — a real API key exists for the user
--   • stepOtpSent         — a real sandbox OTP was sent successfully
--   • stepOtpVerified     — a real sandbox OTP was verified successfully
-- completedAt is set once all 3 step flags are true.
--
-- Account-deletion: NOT NULL userId + ON DELETE CASCADE — the row is owned
-- by the user and has no independent existence. The deleteUserAccount()
-- service also explicitly deletes it (defense-in-depth).
-- ============================================================================

CREATE TABLE "OnboardingProgress" (
    "id"                  SERIAL       NOT NULL,
    "userId"              INTEGER      NOT NULL,
    "stepApiKeyCreated"  BOOLEAN      NOT NULL DEFAULT false,
    "stepOtpSent"         BOOLEAN      NOT NULL DEFAULT false,
    "stepOtpVerified"     BOOLEAN      NOT NULL DEFAULT false,
    "completedAt"         TIMESTAMP(3),
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingProgress_pkey" PRIMARY KEY ("id")
);

-- 1:1 — one onboarding row per user.
CREATE UNIQUE INDEX "OnboardingProgress_userId_key" ON "OnboardingProgress"("userId");

ALTER TABLE "OnboardingProgress"
  ADD CONSTRAINT "OnboardingProgress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "OnboardingProgress_userId_idx" ON "OnboardingProgress"("userId");
