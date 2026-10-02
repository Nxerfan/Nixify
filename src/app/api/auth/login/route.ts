import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { checkAccountLock } from "@/lib/security";
import { logger } from "@/lib/logger";
import { safeErrorRep } from "@/lib/log-sanitizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login — { email, password }
 * Requires emailVerified. On success, (re-)issues the JWT cookie (7-day expiry)
 * with the user's current `sessionVersion` claim.
 *
 * Account-lock enforcement: lock state is checked AFTER successful password
 * verification (so lock status is not an account-enumeration signal). An
 * active lock denies login with the existing bounded account-lock error
 * contract; an expired temporary lock is auto-unlocked and login proceeds.
 */
export async function POST(req: Request) {
  try {

    const [data, err] = await parseBody(req as any, loginSchema);
    if (err) return err;

    const { email, password } = data;

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        emailVerified: true,
        profileCompleted: true,
        sessionVersion: true,
      },
    });
    // Use the same message for "no user" and "wrong password" to avoid enumeration.
    const invalid = apiError(
      ERROR_CODES.INVALID_CREDENTIALS,
      "Incorrect email or password.",
      401,
    );

    if (!user) return invalid;

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return invalid;

    if (!user.emailVerified) {
      return apiError(
        ERROR_CODES.EMAIL_NOT_VERIFIED,
        "Please verify your email before logging in.",
        403,
      );
    }

    // Account-lock enforcement (after credentials are proven). Check lock state
    // only after a successful password verification so an attacker cannot probe
    // lock status without knowing the password. checkAccountLock auto-unlocks
    // an expired temporary lock (clearing the lock fields) — the user may then
    // log in. An active lock denies login with the bounded account-lock error.
    const lockState = await checkAccountLock(email);
    if (lockState.locked) {
      return apiError(
        ERROR_CODES.LOCKED,
        "Your account is locked. Please try again later or contact support if needed.",
        423,
      );
    }

    // Issue a session with the user's current DB sessionVersion. The
    // authoritative auth check (getAuthenticatedUser) will compare this claim
    // to the DB value on every subsequent protected request.
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
    // raw err.message, password, or credential-adjacent text.
    logger.error("auth_login_failed", {
      component: "auth",
      route: "/api/auth/login",
      error: safeErrorRep(err),
    });
    return apiError(ERROR_CODES.INTERNAL, "Something went wrong. Please try again.", 500);
  }
}
