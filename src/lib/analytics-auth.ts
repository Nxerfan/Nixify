/**
 * Shared auth + scope resolver for analytics routes.
 *
 * Two access modes:
 *   1. Admin (mg_admin cookie) — full access, sees ALL data (no userId filter).
 *   2. User (session cookie) — PRO+ plan required; sees only their own data
 *      (userId filter applied to every OtpEvent query).
 *
 * FREE users are denied (403). Unauthenticated requests are denied (401).
 *
 * Returns `{ ok: true, scope: { userId?: number } | "all" }` on success,
 * or `{ ok: false, status, code, message }` on failure (caller returns apiError).
 */
import { getAdmin } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { ERROR_CODES } from "@/lib/api-response";

export type AnalyticsScope = { userId?: number }; // undefined userId = no filter (admin)

export interface AnalyticsAuthOk {
  ok: true;
  mode: "admin" | "user";
  userId?: number; // the acting user's id (for usage tracking / audit)
  scope: AnalyticsScope; // {} for admin (no filter), { userId: N } for user
}

export interface AnalyticsAuthErr {
  ok: false;
  status: number;
  code: typeof ERROR_CODES.UNAUTHORIZED | typeof ERROR_CODES.FORBIDDEN;
  message: string;
}

/**
 * Resolve the requester and return the analytics scope.
 * Pass the result to `getX(range, scope)` analytics functions.
 */
export async function resolveAnalyticsRequester(): Promise<AnalyticsAuthOk | AnalyticsAuthErr> {
  // Try admin first.
  const admin = await getAdmin();
  if (admin) {
    // Admin sees everything.
    return { ok: true, mode: "admin", userId: Number(admin.sub), scope: {} };
  }

  // Fall back to user session.
  const user = await getAuthenticatedUser();
  if (!user) {
    return {
      ok: false,
      status: 401,
      code: ERROR_CODES.UNAUTHORIZED,
      message: "Login required.",
    };
  }

  // PRO+ entitlement check (FREE denied). We use the API_MESSAGES feature as a
  // proxy for "paid plan" since FREE has access=true but a small quota, while
  // the analytics dashboard itself is a paid-only feature. The cleanest check
  // is plan rank — FREE → 403.
  if (user.plan === "FREE") {
    return {
      ok: false,
      status: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: "Analytics is available on PRO and MAX plans only.",
    };
  }

  // Double-check via canAccess (defense-in-depth — non-FREE plan implies access).
  const access = await canAccess(user.id, FEATURE_KEYS.API_MESSAGES);
  if (!access.allowed) {
    return {
      ok: false,
      status: 403,
      code: ERROR_CODES.FORBIDDEN,
      message: "Analytics is available on PRO and MAX plans only.",
    };
  }

  // User sees only their own data.
  return { ok: true, mode: "user", userId: user.id, scope: { userId: user.id } };
}
