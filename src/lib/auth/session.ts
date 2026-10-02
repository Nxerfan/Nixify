import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { signSession, verifySession, getSessionVersion, SESSION_COOKIE, SESSION_MAX_AGE, type SessionPayload, type IssuancePayload } from "@/lib/auth/jwt";

/**
 * Session cookie management (§13.2) + authoritative server-side auth.
 *
 * Cookie flags:
 *   httpOnly: true  — not readable by JS (XSS protection)
 *   secure:   true  — only sent over HTTPS (localhost is a secure context)
 *   sameSite: "lax" — CSRF protection
 *   path:     "/"   — available app-wide
 *
 * Max age: 7 days. Re-issued (rotated) on each login.
 *
 * ─── Authoritative server-side auth (session-revocation security) ──────────
 *
 * `getAuthenticatedUser()` is the authoritative server-side auth check. It
 * does NOT trust a valid JWT signature alone — after JWT verification it:
 *   1. loads the actual User row from the DB;
 *   2. compares the JWT's sessionVersion claim to `User.sessionVersion`;
 *   3. rejects if the versions differ (revoked session);
 *   4. rejects if the account is actively locked;
 *   5. rejects if the user no longer exists.
 *
 * Current DB account state is authoritative for mutable account-security
 * state. The JWT identifies the user + session generation; it is NOT a
 * seven-day database snapshot of mutable authorization claims.
 *
 * `middleware.ts` (Edge runtime, no DB access) remains a coarse page-redirect
 * guard that verifies the JWT signature only — it is NOT a revocation
 * enforcement point. Authoritative revocation enforcement belongs in
 * server/API data paths (this function).
 */

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // allow HTTP in dev for browser testing
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export async function setSessionCookie(payload: IssuancePayload): Promise<void> {
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
 *
 * Authoritative server-side auth: after JWT verification, loads the actual
 * User row and rejects if:
 *   - the user no longer exists (deleted);
 *   - the JWT's sessionVersion differs from `User.sessionVersion` (revoked);
 *   - the account is actively locked (brute-force or admin lock).
 *
 * Use in API route handlers to enforce auth server-side. The JWT signature
 * layer is retained, but DB account state is authoritative for protected
 * server/API operations.
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
      sessionVersion: true,
    },
  });

  // 1. User no longer exists → session invalid.
  if (!user) return null;

  // 2. Session-version mismatch → revoked session. Treat a missing legacy JWT
  //    claim as 0 (compatibility). Once the DB version is bumped above 0, any
  //    legacy JWT (version 0) or any older JWT fails this check.
  const jwtVersion = getSessionVersion(session);
  if (jwtVersion !== user.sessionVersion) return null;

  // 3. Account actively locked → reject. checkAccountLock semantics: a lock
  //    with an expired lockedUntil is treated as unlocked (auto-unlock), but
  //    that auto-unlock does NOT restore old sessions — the sessionVersion was
  //    already bumped when the lock was applied. A permanent admin lock
  //    (lockedUntil is null but lockedReason is set) is always active.
  if (user.lockedReason) {
    const permanentlyLocked = !user.lockedUntil;
    const temporarilyLocked = user.lockedUntil && user.lockedUntil.getTime() > Date.now();
    if (permanentlyLocked || temporarilyLocked) return null;
    // The temporary lock has expired — the authoritative check treats it as
    // unlocked here. (checkAccountLock() performs the actual auto-unlock field
    // clearing on next login/lock-check; we don't mutate state in this read
    // path.) Old sessions remain invalid because sessionVersion already
    // changed when the lock was applied.
  }

  return user;
}
