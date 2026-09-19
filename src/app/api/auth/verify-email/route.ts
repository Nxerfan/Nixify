import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { verifyEmailSchema } from "@/lib/validation";
import { consumeOtp } from "@/lib/otp/verifier";
import { setSessionCookie } from "@/lib/auth/session";
import { preflightOtpVerify } from "@/lib/security/gate";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-email — { email, code }
 * Verifies the signup OTP, marks the user emailVerified, and sets the session
 * cookie so they're logged in and can complete their profile.
 */
export async function POST(req: Request) {
  try {

    const [data, err] = await parseBody(req as any, verifyEmailSchema);
    if (err) return err;

    const { email, code, purpose } = data;
    const ip = getClientIp(req as any);

    // Security gate (§4 IP verify rate limit)
    const blocked = await preflightOtpVerify(req as any);
    if (blocked) return blocked;

    const result = await consumeOtp({ email, code, purpose: purpose ?? "signup", ip });

    if (result.retryAfterSeconds && (result.decision === "not_found")) {
      // Verify rate limit hit.
      return apiError(
        ERROR_CODES.RATE_LIMITED,
        "Too many attempts. Please wait a minute and try again.",
        429,
      );
    }

    switch (result.decision) {
      case "valid":
        break;
      case "mismatch":
        return apiError(ERROR_CODES.CODE_MISMATCH, "That code didn't match. Please try again.", 400);
      case "expired":
        return apiError(ERROR_CODES.EXPIRED, "Your code has expired. Request a new one.", 410);
      case "locked":
        return apiError(
          ERROR_CODES.LOCKED,
          "Too many incorrect attempts. Please try again later.",
          423,
        );
      case "already_used":
        return apiError(ERROR_CODES.ALREADY_USED, "This code has already been used.", 409);
      case "not_found":
      default:
        return apiError(
          ERROR_CODES.EXPIRED,
          "No active code found. Request a new one.",
          400,
        );
    }

    // Mark the user verified.
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return apiError(ERROR_CODES.NOT_FOUND, "Account not found. Please sign up again.", 404);
    }
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    await setSessionCookie({
      sub: user.id.toString(),
      email: user.email,
      emailVerified: true,
    });

    return apiOk({ message: "Email verified. Welcome!" });

  } catch (err) {
    console.error("[auth/verify-email] unhandled error:", err instanceof Error ? err.message : "unknown");
    return apiError(ERROR_CODES.INTERNAL, "Something went wrong. Please try again.", 500);
  }
}
