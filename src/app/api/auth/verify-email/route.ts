import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { verifyEmailSchema } from "@/lib/validation";
import { consumeOtp } from "@/lib/otp/verifier";
import { setSessionCookie } from "@/lib/auth/session";
import { preflightOtpVerify } from "@/lib/security/gate";
import { getClientIp } from "@/lib/security";
import { logger } from "@/lib/logger";
import { safeErrorRep } from "@/lib/log-sanitizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-email — { email, code }
 * Verifies the signup OTP, marks the user emailVerified, and sets the session
 * cookie so they're logged in and can complete their profile. The session is
 * issued from the CURRENT DB state — the `db.user.update` that marks
 * emailVerified: true returns the authoritative `sessionVersion`, which is
 * used in the issued JWT (no second independent lookup).
 */
export async function POST(req: Request) {
  try {

    const [data, err] = await parseBody(req as any, verifyEmailSchema);
    if (err) return err;

    const { email, code } = data;
    const ip = getClientIp(req as any);

    // Security gate (§4 IP verify rate limit)
    const blocked = await preflightOtpVerify(req as any);
    if (blocked) return blocked;

    // P0: resolve the User BEFORE consumeOtp so we can scope to exact
    // userId + environment=null (web-auth). A v1 development/production OTP
    // must NEVER satisfy /api/auth/verify-email.
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) {
      return apiError(ERROR_CODES.NOT_FOUND, "Account not found. Please sign up again.", 404);
    }

    const result = await consumeOtp({
      email, code, purpose: "signup", ip,
      userId: user.id,
      environment: null,
      context: "web_auth",
    });

    if (result.retryAfterSeconds && (result.decision === "not_found")) {
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

    // Mark the user verified AND select the authoritative sessionVersion from
    // the SAME update result — so the session is issued from current DB state,
    // not a stale lookup. This is the issuance contract: the JWT's
    // sessionVersion must equal the DB value at the moment of issuance.
    const updated = await db.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
      select: { id: true, email: true, sessionVersion: true },
    });

    await setSessionCookie({
      sub: updated.id.toString(),
      email: updated.email,
      emailVerified: true,
      sessionVersion: updated.sessionVersion,
    });

    return apiOk({ message: "Email verified. Welcome!" });

  } catch (err) {
    // Safe logging: use the centralized logger + bounded safeErrorRep — never
    // raw err.message, password, OTP code, or credential-adjacent text.
    logger.error("auth_verify_email_failed", {
      component: "auth",
      route: "/api/auth/verify-email",
      error: safeErrorRep(err),
    });
    return apiError(ERROR_CODES.INTERNAL, "Something went wrong. Please try again.", 500);
  }
}
