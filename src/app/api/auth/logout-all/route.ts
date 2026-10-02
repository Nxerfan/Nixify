import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAuthenticatedUser, clearSessionCookie } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { safeErrorRep } from "@/lib/log-sanitizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout-all — revoke ALL sessions for the authenticated user.
 *
 * Requires an authoritative currently authenticated user (getAuthenticatedUser
 * validates the JWT AND the DB sessionVersion AND the account lock state).
 * Atomically increments the user's `sessionVersion` so that:
 *   - the current browser session is invalidated;
 *   - other browsers' sessions are invalidated;
 *   - previously copied/stolen session cookies are invalidated.
 *
 * Then clears the current session cookie and returns a simple success response.
 *
 * This feature is strictly "Sign out all sessions / devices" through version
 * invalidation. Nixify does NOT maintain a server-side per-device session
 * registry, so this endpoint does NOT enumerate devices, session counts, or
 * last-active session lists.
 *
 * Ordinary `POST /api/auth/logout` clears only the current cookie and does NOT
 * increment sessionVersion.
 */
export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return apiError(ERROR_CODES.UNAUTHORIZED, "You must be logged in.", 401);
    }

    // Atomic increment — revokes ALL sessions for this user (current + other
    // browsers + previously copied/stolen cookies). Uses Prisma's atomic
    // increment operation (no read-calculate-write) to avoid lost updates
    // under concurrent security actions. The current session becomes invalid
    // immediately; the cookie is also cleared below for clean UX.
    await db.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
      select: { id: true },
    });

    // Clear the current browser session cookie.
    await clearSessionCookie();

    return apiOk({ message: "Signed out of all devices." });
  } catch (err) {
    // Safe logging: use the centralized logger + bounded safeErrorRep — never
    // raw err.message or credential-adjacent text.
    logger.error("auth_logout_all_failed", {
      component: "auth",
      route: "/api/auth/logout-all",
      error: safeErrorRep(err),
    });
    return apiError(ERROR_CODES.INTERNAL, "Something went wrong. Please try again.", 500);
  }
}
