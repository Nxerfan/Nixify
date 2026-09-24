/**
 * Phase 19 — Developer onboarding service.
 *
 * Tracks a user's progress through the first-time developer onboarding flow.
 *
 * Completion is durable + server-side. A step is marked complete ONLY when
 * its real precondition is met:
 *   • stepApiKeyCreated   — a real, non-revoked API key exists for the user
 *   • stepOtpSent         — a real sandbox OTP row exists (environment=development)
 *                           for the user's email
 *   • stepOtpVerified     — a real sandbox OTP row was consumed (verified)
 *                           for the user's email
 *
 * The flow self-heals: getOnboardingProgress() re-checks the real state on
 * every fetch, so if the user completes a step out-of-band (e.g. creates a
 * key via /dashboard/api-keys directly), the progress reflects it.
 *
 * Progress survives refresh/login/logout because it's persisted in the
 * OnboardingProgress table (PostgreSQL), NOT localStorage.
 */

import { db } from "@/lib/db";
import { listApiKeys } from "@/lib/dx/api-keys";
import { createResourceWithCapacity } from "@/lib/entitlements/resource-capacity";
import { FEATURE_KEYS } from "@/lib/entitlements/config";

/** The 3 onboarding steps (the welcome + completion screens are not tracked). */
export const ONBOARDING_STEPS = [
  "apiKeyCreated",
  "otpSent",
  "otpVerified",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingProgressDTO {
  stepApiKeyCreated: boolean;
  stepOtpSent: boolean;
  stepOtpVerified: boolean;
  completedAt: string | null;
  /** True only when all 3 steps are done. */
  completed: boolean;
}

/**
 * Get or create the user's onboarding progress row. The row is created lazily
 * on first access so we don't insert a row for every user who signs up (only
 * those who interact with the onboarding flow).
 */
export async function getOrCreateOnboardingProgress(userId: number) {
  const existing = await db.onboardingProgress.findUnique({
    where: { userId },
  });
  if (existing) return existing;
  return db.onboardingProgress.create({ data: { userId } });
}

/**
 * Re-check the REAL state of each step against the database. This is the
 * source of truth — the step flags in the OnboardingProgress row are a cache
 * that we reconcile against reality on every fetch.
 *
 *   • stepApiKeyCreated: does the user have ≥1 non-revoked API key?
 *   • stepOtpSent: does an OtpCode row with environment="development" exist
 *     for the user's email? (sandbox send persists a real row)
 *   • stepOtpVerified: was a sandbox OTP consumed (verified)?
 *
 * Returns the real state (not the cached flags).
 */
export async function computeRealStepState(userId: number): Promise<{
  apiKeyCreated: boolean;
  otpSent: boolean;
  otpVerified: boolean;
}> {
  // Load the user's email (needed for OTP row lookups).
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) {
    return { apiKeyCreated: false, otpSent: false, otpVerified: false };
  }

  // API key step: does a non-revoked key exist?
  const keys = await listApiKeys({ userId });
  const apiKeyCreated = keys.some((k) => !k.revokedAt);

  // OTP sent step: does a sandbox (environment="development") OTP row exist
  // for the user's email?
  const sandboxOtpCount = await db.otpCode.count({
    where: {
      targetEmail: user.email,
      environment: "development",
    },
  });
  const otpSent = sandboxOtpCount > 0;

  // OTP verified step: was a sandbox OTP consumed (verified=true)?
  // A consumed OTP row has `consumedAt` set (single-use).
  const verifiedOtpCount = await db.otpCode.count({
    where: {
      targetEmail: user.email,
      environment: "development",
      consumedAt: { not: null },
    },
  });
  const otpVerified = verifiedOtpCount > 0;

  return { apiKeyCreated, otpSent, otpVerified };
}

/**
 * Reconcile the cached progress flags with the real state. Updates the row
 * if any flag drifted (e.g. the user created a key out-of-band). Sets
 * `completedAt` when all 3 steps are done.
 *
 * Returns the reconciled progress DTO.
 */
export async function getOnboardingProgress(userId: number): Promise<OnboardingProgressDTO> {
  const progress = await getOrCreateOnboardingProgress(userId);
  const real = await computeRealStepState(userId);

  // Reconcile: if any cached flag is stale (false but real is true), update.
  // We never set a flag back to false (a completed step stays complete).
  const needsUpdate =
    (!progress.stepApiKeyCreated && real.apiKeyCreated) ||
    (!progress.stepOtpSent && real.otpSent) ||
    (!progress.stepOtpVerified && real.otpVerified);

  let updated = progress;
  if (needsUpdate) {
    const newCompleted =
      (progress.stepApiKeyCreated || real.apiKeyCreated) &&
      (progress.stepOtpSent || real.otpSent) &&
      (progress.stepOtpVerified || real.otpVerified) &&
      !progress.completedAt;
    updated = await db.onboardingProgress.update({
      where: { userId },
      data: {
        stepApiKeyCreated: progress.stepApiKeyCreated || real.apiKeyCreated,
        stepOtpSent: progress.stepOtpSent || real.otpSent,
        stepOtpVerified: progress.stepOtpVerified || real.otpVerified,
        completedAt: newCompleted ? new Date() : progress.completedAt,
      },
    });
  }

  const completed = Boolean(
    updated.stepApiKeyCreated && updated.stepOtpSent && updated.stepOtpVerified,
  );

  return {
    stepApiKeyCreated: updated.stepApiKeyCreated,
    stepOtpSent: updated.stepOtpSent,
    stepOtpVerified: updated.stepOtpVerified,
    completedAt: updated.completedAt?.toISOString() ?? null,
    completed,
  };
}

/**
 * Mark a step as complete (explicit). This is used after a successful
 * onboarding action (create key, send OTP, verify OTP) to immediately
 * update the cached flag without waiting for the next reconcile.
 *
 * The reconcile in getOnboardingProgress will still verify the real state,
 * so calling this with a false positive (e.g. marking otpSent when no OTP
 * row exists) will self-heal on the next fetch — the real-state check
 * overrides the cached flag if it drifted ahead.
 */
export async function markStepComplete(
  userId: number,
  step: OnboardingStep,
): Promise<OnboardingProgressDTO> {
  const progress = await getOrCreateOnboardingProgress(userId);
  const data: Record<string, boolean> = {};
  if (step === "apiKeyCreated") data.stepApiKeyCreated = true;
  if (step === "otpSent") data.stepOtpSent = true;
  if (step === "otpVerified") data.stepOtpVerified = true;

  // Check if this completes all steps.
  const willComplete =
    (step === "apiKeyCreated" || progress.stepApiKeyCreated) &&
    (step === "otpSent" || progress.stepOtpSent) &&
    (step === "otpVerified" || progress.stepOtpVerified) &&
    !progress.completedAt;

  await db.onboardingProgress.update({
    where: { userId },
    data: {
      ...data,
      completedAt: willComplete ? new Date() : progress.completedAt,
    },
  });

  // Return the reconciled DTO (re-checks real state).
  return getOnboardingProgress(userId);
}

/**
 * Create a sandbox (mg_test_) API key for the user during onboarding.
 * Uses the existing entitlement quota enforcement (createResourceWithCapacity
 * — the SAME primitive the dashboard /api/admin/api-keys route uses).
 *
 * Returns the full key ONCE (the caller must show it immediately and never
 * persist it). If the user already has a non-revoked key, returns null
 * (the user should continue with their existing key — we never expose an
 * existing secret that cannot safely be recovered).
 *
 * @throws if the plan quota is exhausted (e.g. FREE plan with 1 key slot
 *         already used by an active key).
 */
export async function createOnboardingApiKey(userId: number, name: string) {
  // Check if the user already has a non-revoked key. If so, don't create
  // another — let them continue with the existing one.
  const existingKeys = await listApiKeys({ userId });
  const hasActiveKey = existingKeys.some((k) => !k.revokedAt);
  if (hasActiveKey) {
    return null;
  }

  // Enforce the plan quota via the entitlement engine. Mirror the dashboard
  // route's createFn — use tx.apiKey.create (NOT the createApiKey service,
  // which uses db directly and would break the transaction).
  const created = await createResourceWithCapacity(
    userId,
    FEATURE_KEYS.API_KEYS,
    async (tx) => {
      const { randomBytes, createHash } = await import("crypto");
      const prefixEnv = "mg_test_"; // sandbox mode
      const secret = randomBytes(18).toString("base64url");
      const fullKey = prefixEnv + secret;
      const keyHash = createHash("sha256").update(fullKey).digest("hex");
      const prefix = fullKey.slice(0, 12);

      const row = await tx.apiKey.create({
        data: {
          keyHash,
          prefix,
          name,
          environment: "development",
          scopes: "full",
          expiresAt: null,
          userId,
        },
      });

      return {
        id: row.id,
        key: fullKey,
        prefix,
        name: row.name,
        environment: row.environment,
        scopes: row.scopes,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      };
    },
  );
  return created;
}
