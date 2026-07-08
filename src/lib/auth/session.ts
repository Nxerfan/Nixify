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
 */
export async function getAuthenticatedUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: Number(session.sub) } });
  return user;
}
