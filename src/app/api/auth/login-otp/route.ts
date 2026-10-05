import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { loginOtpSchema } from "@/lib/validation";
import { consumeOtp } from "@/lib/otp/verifier";
import { setSessionCookie } from "@/lib/auth/session";
import { preflightOtpVerify } from "@/lib/security/gate";
import { getClientIp } from "@/lib/security";
import { logger } from "@/lib/logger";
import { safeErrorRep } from "@/lib/log-sanitizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login-otp — { email, code }
 *
 * Dedicated first-party LOGIN OTP verification endpoint. Verifies a
 * login-purpose OTP for an EXISTING verified account and establishes the
 * authenticated session.
 *
 * ─── Purpose isolation (CRITICAL) ───────────────────────────────────────────
 *
 * This route hardcodes `purpose: "login"` server-side. The `purpose` is NOT
 * accepted from the client — a client-controlled purpose can NEVER select
 * what the server consumes. This is the fix for the production bug where a
 * freshly issued login OTP was being verified by /api/auth/verify-email
 * (which hardcodes `purpose: "signup"`). If an older consumed SIGNUP OTP
 * existed for the same user, the signup-only endpoint returned `already_used`
 * even though the new LOGIN OTP had never been used.
 *
 *   login  → POST /api/auth/login-otp  (hardcodes purpose: "login")
 *   signup → POST /api/auth/verify-email (hardcodes purpose: "signup")
 *
 * A signup OTP cannot authenticate via /login-otp, and a login OTP cannot
 * satisfy /verify-email.
 *
 * ─── Account-enumeration resistance (CRITICAL) ─────────────────────────────
 *
 * An unauthenticated caller with an arbitrary invalid code must NOT be able
 * to distinguish:
 *   1. nonexistent account;
 *   2. existing but unverified account;
 *   3. verified account with a wrong OTP.
 *
 * All three cases return the SAME public response:
 *   400 { error: "code_mismatch", message: "That code didn't match. Please try again." }
 *
 * `consumeOtp()` is NOT called for nonexistent or unverified accounts.
 * `emailVerified` is NOT mutated. No session is created.
 *
 * Only AFTER the request reaches an eligible verified account's OTP
 * evaluation do the meaningful post-proof errors surface:
 *   mismatch / expired / locked / already_used / rate_limited / valid.
 *
 * ─── Session issuance ──────────────────────────────────────────────────────
 *
 * The session is issued from the user's CURRENT authoritative
 * `sessionVersion` (read via a dedicated select, NOT from the consumeOtp
 * result). This mirrors the issuance contract used by /api/auth/login:
 * the JWT's sessionVersion must equal the DB value at the moment of issuance.
 *
 * `consumeOtp()` is called EXACTLY ONCE. The returned `requestId` is the
 * authoritative correlation ID — no second OTP DB lookup is performed.
 *
 * An `already_used` result is NEVER converted into success. A genuine replay
 * must not receive a new authenticated session.
 */

// The single indistinguishable public response for all common invalid-auth
// cases (nonexistent / unverified / wrong-code). Defined once so all three
// code paths return the exact same bytes.
const MISMATCH_RESPONSE = () =>
  apiError(
    ERROR_CODES.CODE_MISMATCH,
    "That code didn't match. Please try again.",
    400,
  );

export async function POST(req: Request) {
  try {
    const [data, err] = await parseBody(req as any, loginOtpSchema);
    if (err) return err;

    const { email, code } = data;
    const ip = getClientIp(req as any);

    // Security gate (§4 IP verify rate limit) — same gate as /verify-email.
    const blocked = await preflightOtpVerify(req as any);
    if (blocked) return blocked;

    // Resolve the user BEFORE consumeOtp so we can scope to exact userId +
    // environment=null (web-auth). A v1 development/production OTP must NEVER
    // satisfy /api/auth/login-otp.
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        profileCompleted: true,
        sessionVersion: true,
      },
    });

    // ─── Account-enumeration resistance ───────────────────────────────────
    //
    // A nonexistent OR unverified account returns the SAME public response as
    // a verified account with a wrong OTP. The caller cannot distinguish
    // these three cases. consumeOtp() is NOT called. No session. No
    // emailVerified mutation.
    if (!user || !user.emailVerified) {
      return MISMATCH_RESPONSE();
    }

    // At this point the account exists and is verified — the request has
    // reached an eligible account's OTP evaluation. Meaningful post-proof
    // errors now surface.
    const result = await consumeOtp({
      email,
      code,
      // SERVER-SIDE HARDCODED PURPOSE — never client-controlled.
      purpose: "login",
      ip,
      userId: user.id,
      environment: null,
      context: "web_auth",
    });

    // Rate-limited not_found (too many attempts on a nonexistent code).
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
        return MISMATCH_RESPONSE();
      case "expired":
        return apiError(
          ERROR_CODES.EXPIRED,
          "Your code has expired. Request a new one.",
          410,
        );
      case "locked":
        return apiError(
          ERROR_CODES.LOCKED,
          "Too many incorrect attempts. Please try again later.",
          423,
        );
      case "already_used":
        // NEVER authenticate an already_used result. A genuine replay must
        // not receive a new session.
        return apiError(
          ERROR_CODES.ALREADY_USED,
          "This code has already been used.",
          409,
        );
      case "not_found":
      default:
        return apiError(
          ERROR_CODES.EXPIRED,
          "No active code found. Request a new one.",
          400,
        );
    }

    // Issue the session with the user's CURRENT authoritative sessionVersion.
    // Read via a dedicated select (NOT from consumeOtp result) so the
    // issuance contract matches /api/auth/login: the JWT's sessionVersion
    // must equal the DB value at the moment of issuance.
    await setSessionCookie({
      sub: user.id.toString(),
      email: user.email,
      emailVerified: true,
      sessionVersion: user.sessionVersion,
    });

    return apiOk({
      message: "Logged in",
      profileCompleted: user.profileCompleted,
    });
  } catch (err) {
    // Safe logging: use the centralized logger + bounded safeErrorRep — never
    // raw err.message, password, OTP code, or credential-adjacent text.
    logger.error("auth_login_otp_failed", {
      component: "auth",
      route: "/api/auth/login-otp",
      error: safeErrorRep(err),
    });
    return apiError(
      ERROR_CODES.INTERNAL,
      "Something went wrong. Please try again.",
      500,
    );
  }
}
