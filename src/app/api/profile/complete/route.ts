import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { profileCompleteSchema } from "@/lib/validation";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRIAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * POST /api/profile/complete — (auth) { fullName, phoneNumber }
 * Validates the phone (E.164-ish), persists profile fields, and activates the
 * 1-month free trial at this exact moment (§8).
 */
export async function POST(req: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "You must be logged in.", 401);
  }

  const [data, err] = await parseBody(req as any, profileCompleteSchema);
  if (err) return err;

  const now = new Date();
  const trialStartedAt = now;
  const trialExpiresAt = new Date(now.getTime() + TRIAL_MS);

  const updated = await db.user.update({
    where: { id: user.id },
    data: {
      fullName: data.fullName,
      phoneNumber: data.phoneNumber,
      profileCompleted: true,
      trialStartedAt,
      trialExpiresAt,
    },
  });

  return apiOk({
    message: "Profile completed. Your 1-month free trial is now active.",
    user: sanitizeUser(updated),
    trial: {
      active: true,
      startedAt: trialStartedAt,
      expiresAt: trialExpiresAt,
      daysRemaining: 30,
    },
  });
}

function sanitizeUser(u: { id: bigint; email: string; emailVerified: boolean; fullName: string | null; phoneNumber: string | null; profileCompleted: boolean; trialStartedAt: Date | null; trialExpiresAt: Date | null }) {
  return {
    id: u.id.toString(),
    email: u.email,
    emailVerified: u.emailVerified,
    fullName: u.fullName,
    phoneNumber: u.phoneNumber,
    profileCompleted: u.profileCompleted,
    trialStartedAt: u.trialStartedAt,
    trialExpiresAt: u.trialExpiresAt,
  };
}
