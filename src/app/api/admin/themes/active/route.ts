import { db } from "@/lib/db";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { resolveThemesViewer } from "@/lib/themes-auth";
import { z } from "zod";
import { parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const activateSchema = z.object({
  id: z.number(),
  purpose: z.enum(["signup", "login", "reset", "verification", "2fa", "all"]),
});

/** POST /api/admin/themes/active — activate a theme for a purpose (dynamic rules).
 *  Access: any authenticated user. Ownership + PRO+ entitlement enforced. */
export async function POST(req: Request) {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const [data, err] = await parseBody(req as any, activateSchema);
  if (err) return err;

  // Ownership: load the theme and verify the requester can modify it.
  const theme = await db.emailTheme.findUnique({ where: { id: data.id } });
  if (!theme) {
    return apiError(ERROR_CODES.NOT_FOUND, "Theme not found.", 404);
  }
  if (!auth.canModify(theme.userId)) {
    return apiError(ERROR_CODES.FORBIDDEN, "You do not own this theme.", 403);
  }

  // Entitlement: dynamic theme rules are PRO+ only (access-gated).
  const { canAccess } = await import("@/lib/entitlements/engine");
  const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");
  const access = await canAccess(auth.userId, FK.DYNAMIC_THEME_RULES);
  if (!access.allowed) {
    return apiError(ERROR_CODES.FORBIDDEN, "Dynamic theme rules are not available on your plan.", 403);
  }

  // Deactivate any other active theme for this purpose owned by the same user
  // (admin activations are global; user activations are per-user).
  const ownerFilter = auth.mode === "admin" ? {} : { userId: auth.userId };
  await db.emailTheme.updateMany({
    where: { purpose: data.purpose, isActive: true, ...ownerFilter },
    data: { isActive: false },
  });
  // Activate the selected one.
  await db.emailTheme.update({
    where: { id: data.id },
    data: { isActive: true, purpose: data.purpose },
  });
  return apiOk({ message: `Theme activated for ${data.purpose}` });
}

/** GET /api/admin/themes/active — list active themes per purpose.
 *  Access: any authenticated user. Admin sees all; user sees own active themes. */
export async function GET() {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const where = auth.mode === "admin"
    ? { isActive: true }
    : { isActive: true, OR: [{ userId: auth.userId }, { userId: null }] };

  const active = await db.emailTheme.findMany({ where });
  return apiOk({
    active: active.map((t) => ({
      id: t.id,
      name: t.name,
      purpose: t.purpose,
      templateId: t.templateId,
      userId: t.userId,
    })),
  });
}
