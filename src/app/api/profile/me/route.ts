import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/profile/me — (auth) returns the authenticated user's profile.
 *
 * Commercial access is determined solely by `User.plan` and the canonical
 * entitlement engine. There is no trial product — the legacy
 * `trialStartedAt` / `trialExpiresAt` columns are NOT read or returned.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "You must be logged in.", 401);
  }

  return apiOk({
    user: {
      id: user.id.toString(),
      email: user.email,
      emailVerified: user.emailVerified,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      profileCompleted: user.profileCompleted,
      plan: user.plan,
    },
  });
}
