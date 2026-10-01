import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getOnboardingProgress } from "@/lib/onboarding/onboarding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding/progress
 * Authenticated — returns the user's onboarding progress, reconciled against
 * the real database state (a step is complete only if its real precondition
 * is met, not just because a flag was set).
 *
 * Also returns the user's normalized email so the UI can prefill it read-only
 * for the sandbox OTP exercise. This aligns the onboarding email UX with the
 * progress truth: the sandbox OTP must target the authenticated user's email,
 * so the UI is deterministic — the user can't send to an arbitrary email and
 * then mysteriously fail to advance onboarding.
 */
export async function GET() {
  const { getAuthenticatedUser } = await import("@/lib/auth/session");
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Sign in required.", 401);
  }
  const progress = await getOnboardingProgress(user.id);
  return apiOk({
    progress,
    // The user's normalized email — the deterministic target for the sandbox
    // OTP exercise. The UI prefills this read-only so the user can't enter
    // a different email and fail to advance onboarding.
    email: user.email,
  });
}
