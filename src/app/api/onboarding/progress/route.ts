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
 */
export async function GET() {
  const { getAuthenticatedUser } = await import("@/lib/auth/session");
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Sign in required.", 401);
  }
  const progress = await getOnboardingProgress(user.id);
  return apiOk({ progress });
}
