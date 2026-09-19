import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { signupSchema } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { issueOtp } from "@/lib/otp/verifier";
import { resolveRequestUserLocale } from "@/lib/i18n/resolve";
import { preflightOtpSend } from "@/lib/security/gate";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup — { email, password }
 * Creates an unverified user (or re-arms an existing unverified one) and sends a
 * signup OTP. The OTP is delivered over real SMTP (Architecture A).
 */
export async function POST(req: Request) {
  try {

    const [data, err] = await parseBody(req as any, signupSchema);
    if (err) return err;

    const { email, password } = data;
    const ip = getClientIp(req as any);

    // Security gate (§4 IP, §5 device, §6 VPN, §7 disposable)
    const blocked = await preflightOtpSend(req as any, email);
    if (blocked) return blocked;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.emailVerified) {
      return apiError(
        ERROR_CODES.EMAIL_EXISTS,
        "An account with this email already exists. Try logging in.",
        409,
      );
    }

    const passwordHash = await hashPassword(password);

    let user;
    if (existing && !existing.emailVerified) {
      // Re-signup: rotate the password and keep the same id.
      user = await db.user.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
    } else {
      user = await db.user.create({
        data: { email, passwordHash, emailVerified: false },
      });
    }

    try {
      // Phase 13: resolve locale for localized OTP email.
      const locale = await resolveRequestUserLocale({ request: req, userId: user.id });
      await issueOtp({ email, purpose: "signup", userId: user.id, ip, locale });
    } catch (e: any) {
      if (e?.message === "rate_limited") {
        return apiError(
          ERROR_CODES.RATE_LIMITED,
          "Too many codes requested. Please wait a minute and try again.",
          429,
        );
      }
      if (e?.message === "locked") {
        return apiError(
          ERROR_CODES.LOCKED,
          "Too many attempts. Please try again later.",
          423,
        );
      }
      console.error("signup issueOtp failed:", e instanceof Error ? e.message : "unknown");
      return apiError(
        ERROR_CODES.INTERNAL,
        "Could not send verification email. Check SMTP configuration.",
        500,
      );
    }

    return apiOk({ message: "Verification code sent. Check your inbox." }, 201);

  } catch (err) {
    console.error("[auth/signup] unhandled error:", err instanceof Error ? err.message : "unknown");
    return apiError(ERROR_CODES.INTERNAL, "Something went wrong. Please try again.", 500);
  }
}
