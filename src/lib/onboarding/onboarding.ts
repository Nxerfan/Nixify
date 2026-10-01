/**
 * Phase 19 — Developer onboarding service (blocker fixes).
 *
 * Tracks a user's progress through the first-time developer onboarding flow.
 *
 * Completion is durable + server-side. A step is marked complete ONLY when
 * its real precondition is met — and ONLY by server-side reconciliation.
 * There is NO public mutable mark-step endpoint. The client can only GET
 * progress; the server reconciles cached flags against real DB state on
 * every fetch.
 *
 * Blocker 1 — no client-controlled progress bypass:
 *   The public mark-step endpoint is removed. Cached flags are advanced ONLY
 *   by getOnboardingProgress() reconciliation, which checks real evidence.
 *   A forged client request cannot advance progress.
 *
 * Blocker 2 — tenant-bound sandbox OTP rows:
 *   Sandbox OTP rows store the owning API-key user's id (OtpCode.userId).
 *   Reconciliation requires:
 *     - userId === current authenticated user
 *     - targetEmail === current user's normalized email
 *     - environment === "development"
 *     - purpose === "signup"
 *   For verified: consumedAt != null.
 *   An OTP created using another tenant's API key NEVER advances this user.
 *
 * Blocker 3 — onboarding-usable API key:
 *   The API-key step requires a key that is:
 *     - owned by the current user
 *     - not revoked
 *     - not expired
 *     - environment === "development" (sandbox)
 *     - authorized for OTP send + verify (scopes "full" or includes both)
 *   A mg_live_ or read-only key does NOT satisfy the step.
 *
 * Blocker 4 — quota handling:
 *   createResourceWithCapacity reports reason "quota_exhausted" (not
 *   "limit_reached"). The error is mapped to a safe 402 response.
 *
 * Blocker 5 — no dead ends:
 *   If the quota is occupied by an unusable key, the API returns a structured
 *   response with a localized explanation + a link to /dashboard/api-keys.
 *
 * Blocker 7 — reconciliation truth:
 *   Cached flags never get ahead of trusted evidence. The first transition
 *   to complete must be proven by trusted server state. Historical
 *   legitimately completed steps may remain completed after later
 *   cleanup/revocation, but a step can NEVER transition to complete without
 *   real evidence.
 */

import { db } from "@/lib/db";
import { listApiKeys, hasScope } from "@/lib/dx/api-keys";
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

// ─── Blocker 3: onboarding-usable API key ──────────────────────────────────

/**
 * Check if a key is usable for the sandbox OTP flow:
 *   - not revoked (revokedAt is null)
 *   - not expired (expiresAt is null or in the future)
 *   - environment === "development" (sandbox)
 *   - scopes allow otp:send + otp:verify (i.e. "full" or explicit custom scopes)
 */
export function isUsableSandboxKey(key: {
  revokedAt: Date | null;
  expiresAt: Date | null;
  environment: string;
  scopes: string;
}): boolean {
  if (key.revokedAt) return false;
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) return false;
  if (key.environment !== "development") return false;
  // "full" scope covers otp:send + otp:verify. A read_only key does NOT.
  // Custom scopes must include both otp:send AND otp:verify.
  if (key.scopes === "full") return true;
  if (key.scopes === "read_only") return false;
  const scopes = key.scopes.split(",").map((s) => s.trim());
  return scopes.includes("otp:send") && scopes.includes("otp:verify");
}

// ─── Blocker 2: tenant-bound real-state checks ──────────────────────────────

/**
 * Re-check the REAL state of each step against the database. This is the
 * source of truth — the step flags in the OnboardingProgress row are a cache
 * that we reconcile against reality on every fetch.
 *
 * Blocker 2 — tenant binding:
 *   The OTP steps require the OTP row to be owned by the current user
 *   (OtpCode.userId === current user), target the current user's email,
 *   be a sandbox (environment="development") row, and have purpose="signup".
 *   An OTP created using another tenant's API key NEVER advances this user.
 *
 * Blocker 3 — usable API key:
 *   The API-key step requires a key that is usable for the sandbox OTP flow
 *   (owned, not revoked, not expired, environment=development, otp scopes).
 *   A mg_live_ or read_only key does NOT satisfy the step.
 *
 * Returns the real state (not the cached flags).
 */
export async function computeRealStepState(userId: number): Promise<{
  apiKeyCreated: boolean;
  otpSent: boolean;
  otpVerified: boolean;
}> {
  // Load the user's email (needed for OTP row lookups). Normalize to
  // lowercase — the v1 OTP send route lowercases the email in its Zod schema,
  // so OTP rows store the lowercase form. The reconciliation must query with
  // the same normalized form to match.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user) {
    return { apiKeyCreated: false, otpSent: false, otpVerified: false };
  }
  const normalizedEmail = user.email.toLowerCase().trim();

  // API key step (Blocker 3): does a USABLE SANDBOX key exist?
  const keys = await listApiKeys({ userId });
  const apiKeyCreated = keys.some((k) => isUsableSandboxKey(k));

  // OTP sent step (Blocker 2): does a sandbox OTP row exist that is:
  //   - owned by this user (userId === current)
  //   - targets this user's email (normalized lowercase)
  //   - environment = "development"
  //   - purpose = "signup"
  const sandboxOtpCount = await db.otpCode.count({
    where: {
      userId,                          // Blocker 2: tenant-bound
      targetEmail: normalizedEmail,    // Blocker 2: user's own email (normalized)
      environment: "development",      // Blocker 2: sandbox only
      purpose: "signup",               // Blocker 2: onboarding purpose
    },
  });
  const otpSent = sandboxOtpCount > 0;

  // OTP verified step (Blocker 2 + 7): was a tenant-bound sandbox OTP consumed?
  const verifiedOtpCount = await db.otpCode.count({
    where: {
      userId,
      targetEmail: normalizedEmail,
      environment: "development",
      purpose: "signup",
      consumedAt: { not: null }, // Blocker 7: real evidence of verification
    },
  });
  const otpVerified = verifiedOtpCount > 0;

  return { apiKeyCreated, otpSent, otpVerified };
}

// ─── Blocker 1: reconciliation is the ONLY way to advance flags ──────────────

/**
 * Reconcile the cached progress flags with the real state. This is the ONLY
 * way cached flags advance — there is no public mark-step endpoint.
 *
 * Blocker 7 — reconciliation truth:
 *   Cached flags NEVER get ahead of trusted evidence. If a cached flag is
 *   false and the real state is also false, the flag stays false. A step can
 *   only transition to true if the real state proves it. Historical
 *   legitimately completed steps may remain true after later cleanup/revocation
 *   (we never set a flag back to false), but the FIRST transition to true
 *   MUST be proven by real server state.
 *
 * Sets `completedAt` when all 3 steps are done (first time only).
 *
 * Returns the reconciled progress DTO.
 */
export async function getOnboardingProgress(userId: number): Promise<OnboardingProgressDTO> {
  const progress = await getOrCreateOnboardingProgress(userId);
  const real = await computeRealStepState(userId);

  // Reconcile: if any cached flag is false but the real state is true,
  // advance the flag. We NEVER set a flag back to false (a completed step
  // stays complete — historical legitimacy).
  const needsUpdate =
    (!progress.stepApiKeyCreated && real.apiKeyCreated) ||
    (!progress.stepOtpSent && real.otpSent) ||
    (!progress.stepOtpVerified && real.otpVerified);

  let updated = progress;
  if (needsUpdate) {
    const newStepApiKey = progress.stepApiKeyCreated || real.apiKeyCreated;
    const newStepOtpSent = progress.stepOtpSent || real.otpSent;
    const newStepOtpVerified = progress.stepOtpVerified || real.otpVerified;
    const newCompleted = newStepApiKey && newStepOtpSent && newStepOtpVerified && !progress.completedAt;
    updated = await db.onboardingProgress.update({
      where: { userId },
      data: {
        stepApiKeyCreated: newStepApiKey,
        stepOtpSent: newStepOtpSent,
        stepOtpVerified: newStepOtpVerified,
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

// ─── Blocker 3 + 4 + 5: API key creation with usable-key + quota handling ────

export interface OnboardingKeyResult {
  /** A new key was created — the full plaintext is returned ONCE. */
  created?: { key: string; prefix: string; id: number; name: string; environment: string };
  /** The user already has a usable sandbox key — continue with it. */
  existingUsable?: true;
  /** Quota is occupied by an unusable key — the user must manage their keys. */
  quotaOccupiedUnusable?: true;
  /** Reconciled progress after the action. */
  progress: OnboardingProgressDTO;
}

/**
 * Create a sandbox (mg_test_) API key for the user during onboarding, OR
 * detect that a usable sandbox key already exists.
 *
 * Blocker 3 — usable key definition:
 *   A usable key is owned, not revoked, not expired, environment=development,
 *   and authorized for otp:send + otp:verify. If such a key exists, the step
 *   is already satisfied — return existingUsable.
 *
 * Blocker 4 — quota handling:
 *   createResourceWithCapacity reports reason "quota_exhausted" (not
 *   "limit_reached"). If the quota is occupied by an unusable key, return
 *   quotaOccupiedUnusable so the UI can direct the user to /dashboard/api-keys.
 *
 * Blocker 5 — no dead ends:
 *   If quota is occupied by an unusable key, the UI shows a localized
 *   explanation + a link to manage keys. We never attempt to recover stored
 *   key secrets.
 */
export async function createOrDetectOnboardingApiKey(userId: number, name: string): Promise<OnboardingKeyResult> {
  const keys = await listApiKeys({ userId });

  // Blocker 3: check for a USABLE sandbox key first.
  const usableKey = keys.find((k) => isUsableSandboxKey(k));
  if (usableKey) {
    const progress = await getOnboardingProgress(userId);
    return { existingUsable: true, progress };
  }

  // No usable sandbox key. Check if the quota is occupied by an unusable key.
  // If the user has ANY active (non-revoked) key that's NOT a usable sandbox
  // key, then creating a new sandbox key would likely exceed quota (especially
  // on FREE plan with 1 slot). We still attempt the create — the quota engine
  // will reject it if the slot is occupied — but we detect the unusable case
  // upfront for a better error message.
  const hasActiveUnusableKey = keys.some((k) => !k.revokedAt && !isUsableSandboxKey(k));

  try {
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
        };
      },
    );
    const progress = await getOnboardingProgress(userId);
    return { created, progress };
  } catch (e) {
    const reason = (e as { reason?: string }).reason;
    // Blocker 4: the canonical reason is "quota_exhausted" (or
    // "not_available_on_plan"). If quota is occupied (especially by an
    // unusable key), return quotaOccupiedUnusable so the UI can direct the
    // user to manage their keys.
    if (reason === "quota_exhausted" || reason === "not_available_on_plan") {
      const progress = await getOnboardingProgress(userId);
      return { quotaOccupiedUnusable: true, progress };
    }
    throw e;
  }
}
