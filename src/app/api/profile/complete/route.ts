import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { profileCompleteSchema } from "@/lib/validation";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/profile/complete — (auth) { fullName, phoneNumber }
 *
 * Validates the phone (E.164-ish) and persists profile fields. Sets
 * `profileCompleted = true`. Does NOT modify the user's plan or create any
 * trial state — commercial access is determined solely by `User.plan` and the
 * canonical entitlement engine.
 *
 * The legacy `trialStartedAt` / `trialExpiresAt` Prisma columns remain in the
 * schema for backward compatibility but are NEVER written or read here. They
 * have no effect on entitlements or commercial access.
 */
export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "You must be logged in.", 401);
  }

  const [data, err] = await parseBody(req as any, profileCompleteSchema);
  if (err) return err;

  // HOTFIX(restore-otp-delivery): explicit `select` — default select would
  // try to load firstName/lastName columns that may be pending migration
  // (PR #33). The route only writes fullName/phoneNumber/profileCompleted
  // — firstName/lastName are untouched here.
  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      profileCompleted: true,
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      fullName: true,
      phoneNumber: true,
      profileCompleted: true,
      plan: true,
    },
  });

  return apiOk({
    message: "Profile completed.",
    user: sanitizeUser(updated),
  });
}

function sanitizeUser(u: { id: number; email: string; emailVerified: boolean; fullName: string | null; phoneNumber: string | null; profileCompleted: boolean; plan: string }) {
  return {
    id: u.id.toString(),
    email: u.email,
    emailVerified: u.emailVerified,
    fullName: u.fullName,
    phoneNumber: u.phoneNumber,
    profileCompleted: u.profileCompleted,
    plan: u.plan,
  };
}
