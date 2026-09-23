import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { signSession, verifySession, SESSION_COOKIE, SESSION_MAX_AGE, type SessionPayload } from "@/lib/auth/jwt";

/**
 * Session cookie management (§13.2).
 *
 * Cookie flags:
 *   httpOnly: true  — not readable by JS (XSS protection)
 *   secure:   true  — only sent over HTTPS (localhost is a secure context)
 *   sameSite: "lax" — CSRF protection
 *   path:     "/"   — available app-wide
 *
 * Max age: 7 days. Re-issued (rotated) on each login.
 */

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // allow HTTP in dev for browser testing
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export async function setSessionCookie(payload: Omit<SessionPayload, "iat" | "exp">): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, COOKIE_OPTIONS);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/**
 * Returns the authenticated user row, or null if no valid session.
 * Use in API route handlers to enforce auth server-side.
 *
 * HOTFIX(restore-otp-delivery): explicit `select` instead of default select.
 * The default select would try to load `firstName`/`lastName` columns that
 * were added to the Prisma schema in PR #33 but whose migration
 * (20260924000000_add_user_names_and_ondelete_rules) is NOT applied to
 * production Neon because the Vercel deploy pipeline runs only
 * `prisma generate` (postinstall) + `next build` — never `prisma migrate deploy`.
 * Default-select queries therefore throw a Prisma error (P2021) on production.
 * Explicit `select` of only the fields consumed by callers makes the query
 * resilient to pending additive column migrations.
 *
 * `firstName`/`lastName` are intentionally NOT selected here — they are only
 * consumed by /api/profile/me, which loads them via a separate guarded query
 * with a null fallback. This keeps the dashboard/auth paths working even when
 * the additive migration is pending.
 */
export async function getAuthenticatedUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: Number(session.sub) },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      emailVerified: true,
      profileCompleted: true,
      plan: true,
      fullName: true,
      phoneNumber: true,
      createdAt: true,
      trialStartedAt: true,
      trialExpiresAt: true,
      lockedReason: true,
      lockedUntil: true,
      lockedAt: true,
      preferredLocale: true,
    },
  });
  return user;
}
