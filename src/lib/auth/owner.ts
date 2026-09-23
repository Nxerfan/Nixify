/**
 * Shared ownership/auth context resolver for tenant-scoped resources.
 *
 * CRITICAL RULE: AdminUser.id is NOT User.id.
 *
 * Admin mode is an authorization context — admin can ACCESS tenant resources
 * but does NOT OWN them. For tenant-owned resources:
 *   - `userId` must always refer to a real `User.id`
 *   - Admin mode: `userId = null` (admin doesn't own tenant resources)
 *   - User mode: `userId = the real User.id`
 *
 * Admin can modify any resource (`canModify: () => true`).
 * User can only modify resources they own (`canModify: (owner) => owner === userId`).
 *
 * This helper generalizes the pattern from `themes-auth.ts` and `analytics-auth.ts`
 * so all new product routes (Contacts, Templates, Messages, etc.) use the same
 * ownership boundary.
 */
import { getAdmin } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { ERROR_CODES } from "@/lib/api-response";

export interface ApiOwner {
  ok: true;
  mode: "admin" | "user";
  /** The real User.id for user mode. `null` for admin mode (admin doesn't own tenant resources). */
  userId: number | null;
  /** Whether the requester is an admin. */
  isAdmin: boolean;
  /** Query scope filter. Admin: {} (no filter, sees all). User: { userId: N } (own only). */
  scope: { userId?: number };
  /** Returns true if this requester can modify a resource owned by `ownerUserId`. */
  canModify: (ownerUserId: number | null) => boolean;
}

export interface ApiOwnerErr {
  ok: false;
  status: number;
  code: typeof ERROR_CODES.UNAUTHORIZED;
  message: string;
}

/**
 * Resolve the requester for tenant-scoped API routes.
 *
 * Tries admin cookie first, then user session.
 * - Admin: `userId = null`, `isAdmin = true`, `canModify = () => true`, `scope = {}`
 * - User: `userId = User.id`, `isAdmin = false`, `canModify = (owner) => owner === userId`, `scope = { userId }`
 * - Neither: returns 401 error
 */
export async function resolveApiOwner(): Promise<ApiOwner | ApiOwnerErr> {
  // Try admin first.
  const admin = await getAdmin();
  if (admin) {
    return {
      ok: true,
      mode: "admin",
      userId: null, // Admin doesn't own tenant resources
      isAdmin: true,
      scope: {}, // Admin sees all — no userId filter
      canModify: () => true, // Admin can modify any resource
    };
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

  return {
    ok: true,
    mode: "user",
    userId: user.id, // Real User.id — used for ownership + entitlement checks
    isAdmin: false,
    scope: { userId: user.id }, // User sees only their own resources
    canModify: (ownerUserId) => ownerUserId === user.id,
  };
}
