import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { signupSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { issueOtp } from "@/lib/otp/verifier";
import { resolveRequestUserLocale } from "@/lib/i18n/resolve";
import { preflightOtpSend } from "@/lib/security/gate";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/signup — { email, password, fullName? }
 *
 * First-party signup state machine (corrected):
 *
 *   form (fullName, email, real password)
 *     → /api/auth/signup ONCE
 *     → create OR update UNVERIFIED user with the REAL password (+ fullName)
 *     → send signup OTP
 *     → /api/auth/verify-email marks the SAME user verified + establishes session
 *     → success/dashboard
 *
 * There is NO second /signup call after OTP verification. The client never
 * stores a temporary password — the real password is submitted once and
 * persisted immediately (hashed).
 *
 * Security invariants:
 *   - If the email belongs to an ALREADY VERIFIED user, return EMAIL_EXISTS.
 *     Never overwrite a verified account's password via /signup.
 *   - If the email belongs to an UNVERIFIED user, the password is rotated to
 *     the newly submitted real password (acceptable — the account is still
 *     unverified).
 *   - The OTP contract (6 ASCII digits, 10-min TTL, max 5 attempts, HMAC,
 *     single-use, purpose="signup") is unchanged.
 *
 * `fullName` is persisted when supplied (on both new-user creation and
 * unverified re-signup). It does NOT set profileCompleted — that remains
 * the responsibility of the existing /api/profile/complete flow.
 */
export async function POST(req: Request) {
  try {

    const [data, err] = await parseBody(req as any, signupSchema);
    if (err) return err;

    const { email, password, fullName } = data;
    const ip = getClientIp(req as any);

    // Security gate (§4 IP, §5 device, §6 VPN, §7 disposable)
    const blocked = await preflightOtpSend(req as any, email);
    if (blocked) return blocked;

    // HOTFIX(restore-otp-delivery): explicit `select` — see PR #34. Default
    // select would try to load firstName/lastName columns that may be pending
    // migration. We only need id + emailVerified here.
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    });
    // SECURITY INVARIANT: a verified user's password is NEVER overwritten via
    // /signup. This prevents account-takeover via the signup endpoint.
    if (existing && existing.emailVerified) {
      return apiError(
        ERROR_CODES.EMAIL_EXISTS,
        "An account with this email already exists. Try logging in.",
        409,
      );
    }

    const passwordHash = await hashPassword(password);

    // Build the data payload. `fullName` is persisted when supplied (on
    // both new-user creation and unverified re-signup). `undefined` means
    // the field was not sent — we do NOT null out an existing fullName on
    // re-signup if the client omitted it (backward-compatible).
    const userData: { passwordHash: string; fullName?: string } = { passwordHash };
    if (fullName !== undefined) userData.fullName = fullName;

    let user: { id: number };
    if (existing && !existing.emailVerified) {
      // Re-signup: rotate the password (and fullName if supplied) and keep
      // the same id. The account remains unverified until OTP verification.
      const updated = await db.user.update({
        where: { id: existing.id },
        data: userData,
        select: { id: true },
      });
      user = updated;
    } else {
      // New user: create with the REAL password hash (+ optional fullName).
      // emailVerified starts false — OTP verification flips it.
      const created = await db.user.create({
        data: { email, ...userData, emailVerified: false },
        select: { id: true },
      });
      user = created;
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
      // Detect missing SMTP env vars — common on Vercel Preview
    if (e instanceof Error && e.message.includes("Missing required env var: SMTP_")) {
      console.error("[auth/signup] SMTP config missing:", e.message);
      return apiError(ERROR_CODES.MAIL_CONFIG_MISSING, "Email delivery is not configured on this deployment. Contact the administrator.", 503);
    }
    console.error("[auth/signup] issueOtp failed:", e instanceof Error ? e.message : "unknown", e instanceof Error ? e.stack : "");
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
