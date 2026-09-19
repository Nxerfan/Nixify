import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation";
import { consumeOtp } from "@/lib/otp/verifier";
import { hashPassword } from "@/lib/auth/password";
import { preflightOtpVerify } from "@/lib/security/gate";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset-password — { email, code, newPassword }
 * Verifies the reset OTP through the same engine as signup, then updates the
 * password hash. A successfully consumed reset code is single-use.
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

    const result = await consumeOtp({ email, code, purpose: "reset", ip });

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

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return apiError(ERROR_CODES.NOT_FOUND, "Account not found.", 404);
    }

    const passwordHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return apiOk({ message: "Your password has been updated. You can now log in." });

  } catch (err) {
    console.error("[auth/reset-password] unhandled error:", err instanceof Error ? err.message : "unknown");
    return apiError(ERROR_CODES.INTERNAL, "Something went wrong. Please try again.", 500);
  }
}
