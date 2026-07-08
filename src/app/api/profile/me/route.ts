import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/profile/me — (auth) returns the profile + computed trial status.
 * `isTrialActive` is computed at request time from trialExpiresAt vs now (never
 * trusted from client cache, per §8).
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "You must be logged in.", 401);
  }

  const now = Date.now();
  const expiresMs = user.trialExpiresAt ? user.trialExpiresAt.getTime() : null;
  const active = !!user.trialExpiresAt && expiresMs! > now;
  const daysRemaining = active
    ? Math.max(0, Math.ceil((expiresMs! - now) / (24 * 60 * 60 * 1000)))
    : 0;

  return apiOk({
    user: {
      id: user.id.toString(),
      email: user.email,
      emailVerified: user.emailVerified,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      profileCompleted: user.profileCompleted,
      trialStartedAt: user.trialStartedAt,
      trialExpiresAt: user.trialExpiresAt,
      plan: user.plan,
    },
    trial: {
      active,
      daysRemaining,
      expiresAt: user.trialExpiresAt,
      startedAt: user.trialStartedAt,
    },
  });
}
