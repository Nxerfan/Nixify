import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation";
import { consumeOtp } from "@/lib/otp/verifier";
import { hashPassword } from "@/lib/auth/password";
import { preflightOtpVerify } from "@/lib/security/gate";
import { getClientIp } from "@/lib/security";
import { clearSessionCookie } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { safeErrorRep } from "@/lib/log-sanitizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset-password — { email, code, newPassword }
 * Verifies the reset OTP through the same engine as signup, then updates the
 * password hash AND atomically increments sessionVersion in the SAME database
 * mutation. A successfully consumed reset code is single-use.
 *
 * After successful reset: clears the current session cookie if one exists and
 * returns the existing safe success contract. All JWTs issued before the reset
 * fail authoritative authentication (sessionVersion mismatch).
 */
export async function POST(req: Request) {
  try {

    const [data, err] = await parseBody(req as any, resetPasswordSchema);
    if (err) return err;

    const { email, code, newPassword } = data;
    const ip = getClientIp(req as any);

    // Security gate (§4 IP verify rate limit)
    const blocked = await preflightOtpVerify(req as any);
    if (blocked) return blocked;

    // P0: resolve the User BEFORE consumeOtp so we can scope to exact
    // userId + environment=null (web-auth). A mg_test_ or mg_live_ OTP
    // owned by another tenant must NEVER authorize password reset.
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      return apiError(ERROR_CODES.NOT_FOUND, "Account not found.", 404);
    }

    const result = await consumeOtp({
      email, code, purpose: "reset", ip,
      userId: user.id,
      environment: null,
      context: "web_auth",
    });

    if (result.retryAfterSeconds && result.decision === "not_found") {
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
        return apiError(ERROR_CODES.LOCKED, "Too many incorrect attempts. Please try again later.", 423);
      case "already_used":
        return apiError(ERROR_CODES.ALREADY_USED, "This code has already been used.", 409);
      case "not_found":
      default:
        return apiError(ERROR_CODES.EXPIRED, "No active code found. Request a new one.", 400);
    }

    const passwordHash = await hashPassword(newPassword);
    // ATOMIC: update passwordHash AND increment sessionVersion in the SAME
    // mutation. If the OTP was valid, both succeed together; if the update
    // fails, the version does not change independently. Prisma's atomic
    // `{ increment: 1 }` avoids lost updates under concurrent security actions.
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
      },
      select: { id: true },
    });

    // Clear the current browser session cookie if one exists — the user must
    // log in again with the new password. All previously issued JWTs are now
    // invalid (sessionVersion mismatch).
    await clearSessionCookie();

    return apiOk({ message: "Your password has been updated. You can now log in." });

  } catch (err) {
    // Safe logging: use the centralized logger + bounded safeErrorRep — never
    // raw err.message, password, OTP code, or credential-adjacent text.
    logger.error("auth_reset_password_failed", {
      component: "auth",
      route: "/api/auth/reset-password",
      error: safeErrorRep(err),
    });
    return apiError(ERROR_CODES.INTERNAL, "Something went wrong. Please try again.", 500);
  }
}
