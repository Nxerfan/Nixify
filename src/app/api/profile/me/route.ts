import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/profile/me — (auth) returns the authenticated user's profile.
 *
 * Commercial access is determined solely by `User.plan` and the canonical
 * entitlement engine. There is no trial product — the legacy
 * `trialStartedAt` / `trialExpiresAt` columns are NOT read or returned.
 *
 * HOTFIX(restore-otp-delivery): `firstName`/`lastName` were added to the
 * Prisma schema in PR #33 but their migration may be pending on production
 * Neon (the Vercel deploy pipeline does not run `prisma migrate deploy`).
 * They are loaded via a separate guarded query with a null fallback so the
 * profile endpoint degrades gracefully (returns null) instead of 500-ing
 * when the columns are absent.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "You must be logged in.", 401);
  }

  // Load firstName/lastName separately with a graceful fallback. If the
  // columns don't exist yet (pending migration), Prisma throws P2021 — we
  // catch it and return null for both fields. Once the migration is applied,
  // this query returns the real values.
  let firstName: string | null = null;
  let lastName: string | null = null;
  try {
    const names = await db.user.findUnique({
      where: { id: user.id },
      select: { firstName: true, lastName: true },
    });
    firstName = names?.firstName ?? null;
    lastName = names?.lastName ?? null;
  } catch {
    // Migration pending — columns don't exist yet. Return null gracefully.
    firstName = null;
    lastName = null;
  }

  return apiOk({
    user: {
      id: user.id.toString(),
      email: user.email,
      emailVerified: user.emailVerified,
      fullName: user.fullName,
      firstName,
      lastName,
      phoneNumber: user.phoneNumber,
      profileCompleted: user.profileCompleted,
      plan: user.plan,
    },
  });
}
