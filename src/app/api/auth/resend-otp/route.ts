import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { resendOtpSchema } from "@/lib/validation";
import { issueOtp } from "@/lib/otp/verifier";
import { resolveRequestUserLocale } from "@/lib/i18n/resolve";
import { preflightOtpSend } from "@/lib/security/gate";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/resend-otp — { email, purpose }
 * Re-issues an OTP for the given purpose. For signup/login we require an account
 * to exist (so we can attach the userId); for reset we still send if the account
 * exists (handled the same way here). Rate-limited via issueOtp.
 */
export async function POST(req: Request) {
  try {

    const [data, err] = await parseBody(req as any, resendOtpSchema);
    if (err) return err;

    const { email, purpose } = data;
    const ip = getClientIp(req as any);

    // Security gate (§4 IP, §5 device, §6 VPN, §7 disposable)
    const blocked = await preflightOtpSend(req as any, email);
    if (blocked) return blocked;

    const user = await db.user.findUnique({ where: { email } });

    // For signup resend: an unverified user may legitimately not exist yet if they
    // never completed signup — but our flow always creates the user first, so a
    // missing user means nothing to resend to. Return a soft 200 to avoid leaking.
    if (!user) {
      return apiOk({ message: "If an account exists, a new code was sent." });
    }

    // For login/reset we also require an account (handled above). For signup we
    // only resend if the account is not yet verified.
    if (purpose === "signup" && user.emailVerified) {
      return apiOk({ message: "Your email is already verified. You can log in." });
    }

    try {
      // Phase 13: resolve locale for localized OTP email.
      const locale = await resolveRequestUserLocale({ request: req, userId: user.id });
      await issueOtp({ email, purpose, userId: user.id, isResend: true, ip, locale });
    } catch (e: any) {
      if (e?.message === "rate_limited") {
        return apiError(
          ERROR_CODES.RATE_LIMITED,
          "Too many codes requested. Please wait a minute and try again.",
          429,
        );
      }
      if (e?.message === "locked") {
        return apiError(ERROR_CODES.LOCKED, "Too many attempts. Please try again later.", 423);
      }
      // Detect missing env vars — log the details server-side, return
      // a generic message to the client (do NOT leak env var names).
      if (e instanceof Error && e.message.includes("Missing required env var:")) {
        console.error("[auth/resend-otp] CONFIG ERROR:", e.message);
        return apiError(ERROR_CODES.MAIL_CONFIG_MISSING, "Email delivery is not configured. Contact the administrator.", 503);
      }
      console.error("[auth/resend-otp] issueOtp failed:", e instanceof Error ? e.message : "unknown", e instanceof Error ? e.stack : "");
      return apiError(ERROR_CODES.INTERNAL, "Could not send verification email.", 500);
    }

    return apiOk({ message: "A new code was sent to your inbox." });

  } catch (err) {
    console.error("[auth/resend-otp] unhandled error:", err instanceof Error ? err.message : "unknown", err instanceof Error ? err.stack : "");
    return apiError(ERROR_CODES.INTERNAL, "Something went wrong. Please try again.", 500);
  }
}
