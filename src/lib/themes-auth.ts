/**
 * Shared auth + scope resolver for Email Themes routes.
 *
 * Access model:
 *   - GET (list/templates/active/preview): any authenticated user (admin OR user).
 *   - Write (save/activate/delete): authenticated user; ownership enforced on writes.
 *
 * Admin is "just another user with full permissions" — they own themes with
 * userId=null (system themes) and can edit any theme. Regular users can only
 * edit themes where userId === their id.
 */
import { getAdmin } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { ERROR_CODES } from "@/lib/api-response";

export interface ThemesAuthOk {
  ok: true;
  mode: "admin" | "user";
  userId: number; // the acting user's id (for ownership + entitlement checks)
  scope: { userId?: number }; // for list queries: admin = no filter, user = own only
  /** Returns true if this requester owns the given theme (or is admin). */
  canModify: (themeOwnerUserId: number | null) => boolean;
}

export interface ThemesAuthErr {
  ok: false;
  status: number;
  code: typeof ERROR_CODES.UNAUTHORIZED | typeof ERROR_CODES.FORBIDDEN;
  message: string;
}

/**
 * Resolve the requester for themes routes. Admin OR any authenticated user.
 * Use this for GET routes (list, templates, active, preview).
 */
export async function resolveThemesViewer(): Promise<ThemesAuthOk | ThemesAuthErr> {
  // Try admin first.
  const admin = await getAdmin();
  if (admin) {
    const adminId = Number(admin.sub);
    return {
      ok: true,
      mode: "admin",
      userId: adminId,
      scope: {}, // admin sees all themes
      canModify: () => true, // admin can modify any theme
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
    userId: user.id,
    scope: { userId: user.id }, // user sees only their own themes
    canModify: (themeOwnerUserId) => themeOwnerUserId === user.id,
  };
}

/**
 * Resolve the requester for themes WRITE routes (save/activate/delete).
 * Same as resolveThemesViewer but semantically distinct for clarity.
 * Ownership is checked against the specific theme in the route handler.
 */
export const resolveThemesEditor = resolveThemesViewer;
