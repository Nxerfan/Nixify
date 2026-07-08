import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/login — { email, password }
 * Requires emailVerified. On success, (re-)issues the JWT cookie (7-day expiry).
 */
export async function POST(req: Request) {
  const [data, err] = await parseBody(req as any, loginSchema);
  if (err) return err;

  const { email, password } = data;

  const user = await db.user.findUnique({ where: { email } });
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

  await setSessionCookie({
    sub: user.id.toString(),
    email: user.email,
    emailVerified: true,
  });

  return apiOk({
    message: "Logged in",
    profileCompleted: user.profileCompleted,
  });
}
