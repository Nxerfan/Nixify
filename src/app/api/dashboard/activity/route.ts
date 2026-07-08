import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { maskEmail } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/activity — real activity for the logged-in user.
 * Returns the user's own OTP events (not admin-scoped).
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "You must be logged in.", 401);
  }

  const events = await db.otpEvent.findMany({
    where: { email: user.email },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const typeMap: Record<string, "signup" | "signin" | "otp_sent" | "otp_verified" | "password_reset"> = {
    requested: "otp_sent",
    sent: "otp_sent",
    verified: "otp_verified",
    failed: "signin",
    expired: "otp_sent",
    resent: "otp_sent",
  };

  const descMap: Record<string, string> = {
    requested: "Requested verification code",
    sent: "OTP email sent",
    verified: "Email verified successfully",
    failed: "OTP verification failed",
    expired: "OTP code expired",
    resent: "Requested new code",
  };

  return apiOk({
    activities: events.map((e) => ({
      id: `act-${e.id}`,
      type: typeMap[e.eventType] || "otp_sent",
      description: descMap[e.eventType] || e.eventType,
      timestamp: e.createdAt.toISOString(),
      email: e.email,
    })),
  });
}
