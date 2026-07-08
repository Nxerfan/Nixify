import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/stats — real stats for the logged-in user.
 * Uses the user's session (not admin) to return:
 *   - Total OTPs sent by this user (today + all time)
 *   - Successful verifications
 *   - Failed verifications
 *   - Days since joined
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "You must be logged in.", 401);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Count OTP events for this user's email
  const [otpsSentToday, otpsVerifiedAllTime, otpsFailedAllTime, signupsThisWeek] = await Promise.all([
    db.otpEvent.count({
      where: {
        email: user.email,
        eventType: { in: ["requested", "resent"] },
        createdAt: { gte: todayStart },
      },
    }),
    db.otpEvent.count({
      where: {
        email: user.email,
        eventType: "verified",
        status: "success",
      },
    }),
    db.otpEvent.count({
      where: {
        email: user.email,
        eventType: "failed",
      },
    }),
    db.user.count({
      where: {
        emailVerified: true,
        createdAt: { gte: weekStart },
      },
    }),
  ]);

  return apiOk({
    totalUsers: await db.user.count(),
    activeSessions: 1, // The current user is active
    otpSentToday: otpsSentToday,
    otpsVerifiedAllTime,
    otpsFailedAllTime,
    signupsThisWeek,
    daysSinceJoined: Math.floor((now.getTime() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
  });
}
