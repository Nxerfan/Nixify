import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { forgotPasswordSchema } from "@/lib/validation";
import { issueOtp } from "@/lib/otp/verifier";
import { resolveRequestUserLocale } from "@/lib/i18n/resolve";
import { preflightOtpSend } from "@/lib/security/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot-password — { email }
 * ALWAYS returns a generic 200 (never reveals whether the email exists) — EXCEPT
 * when the security gate rejects (IP block, disposable email, etc.), which is a
 * property of the request, not the account, so revealing it is safe. If the
 * account exists and the gate passes, sends an OTP with purpose 'reset'.
 */
export async function POST(req: Request) {
  try {

    const [data, err] = await parseBody(req as any, forgotPasswordSchema);
    if (err) return err;

    const { email } = data;

    // Security gate (§4 IP, §5 device, §6 VPN, §7 disposable). Disposable-email
    // rejection is safe to reveal here (it's about the input, not account existence).
    const blocked = await preflightOtpSend(req as any, email);
    if (blocked) return blocked;

    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      try {
        // Phase 13: resolve locale for localized OTP email.
        const locale = await resolveRequestUserLocale({ request: req, userId: user.id });
        await issueOtp({ email, purpose: "reset", userId: user.id, locale });
      } catch (e: any) {
        // Rate limit / lockout: still return 200 to avoid leaking state, but log it.
        console.error(
          "forgot-password issueOtp skipped:",
          e instanceof Error ? e.message : "unknown",
        );
      }
    }

    return apiOk({
      message: "If an account exists for that email, a reset code has been sent.",
    });

  } catch (err) {
    console.error("[auth/forgot-password] unhandled error:", err instanceof Error ? err.message : "unknown");
    return apiError(ERROR_CODES.INTERNAL, "Something went wrong. Please try again.", 500);
  }
}
