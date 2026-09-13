import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { peekUsage, canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/usage
 *
 * Returns the current user's OTP and Messaging usage independently.
 * Reading usage does NOT consume quota (uses peekUsage, not checkUsage).
 *
 * Feature access is resolved via the entitlement engine (canAccess),
 * NOT by checking user.plan directly. Plan names are not feature authorization.
 *
 * Response:
 * {
 *   "otp": { "used": 42, "quota": 100, "remaining": 58, "resetAt": "..." },
 *   "messaging": { "access": false, "used": 0, "quota": 0, "remaining": 0, "resetAt": null },
 *   "apiMessages": { "used": 156, "quota": 1000, "remaining": 844, "resetAt": "..." }
 * }
 *
 * OTP and Messaging quotas are COMPLETELY INDEPENDENT.
 * Consuming one never touches the other.
 */
export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  // Fetch usage counters (read-only — peekUsage does NOT consume quota).
  // Also resolve feature access via the entitlement engine (not plan name).
  // These are independent — consuming OTP_EMAILS does not affect MESSAGING_EMAILS.
  const [otpUsage, messagingUsage, apiMessagesUsage, messagingAccess] = await Promise.all([
    peekUsage(user.id, FEATURE_KEYS.OTP_EMAILS),
    peekUsage(user.id, FEATURE_KEYS.MESSAGING_EMAILS),
    peekUsage(user.id, FEATURE_KEYS.API_MESSAGES),
    canAccess(user.id, FEATURE_KEYS.MESSAGING_EMAILS),
  ]);

  return NextResponse.json({
    otp: {
      used: otpUsage.used,
      quota: otpUsage.quota === Infinity ? "unlimited" : otpUsage.quota,
      remaining: otpUsage.remaining === "unlimited" ? "unlimited" : otpUsage.remaining,
      resetAt: otpUsage.resetAt,
    },
    messaging: {
      // Access is resolved from the entitlement engine, NOT from user.plan.
      // This ensures the response reflects the configured feature entitlement.
      access: messagingAccess.allowed,
      used: messagingUsage.used,
      quota: messagingUsage.quota === Infinity ? "unlimited" : messagingUsage.quota,
      remaining: messagingUsage.remaining === "unlimited" ? "unlimited" : messagingUsage.remaining,
      resetAt: messagingUsage.resetAt,
    },
    apiMessages: {
      used: apiMessagesUsage.used,
      quota: apiMessagesUsage.quota === Infinity ? "unlimited" : apiMessagesUsage.quota,
      remaining: apiMessagesUsage.remaining === "unlimited" ? "unlimited" : apiMessagesUsage.remaining,
      resetAt: apiMessagesUsage.resetAt,
    },
  });
}
