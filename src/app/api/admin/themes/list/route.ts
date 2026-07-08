import { db } from "@/lib/db";
import { apiOk, apiError } from "@/lib/api-response";
import { resolveThemesViewer } from "@/lib/themes-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/themes/list — list saved themes.
 *  Access: any authenticated user. Admin sees all; user sees own + system themes. */
export async function GET() {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  // Admin sees all themes. Users see their own themes PLUS system themes
  // (userId=null) so they can browse the default/template themes.
  const where = auth.mode === "admin"
    ? undefined
    : { OR: [{ userId: auth.userId }, { userId: null }] };

  const themes = await db.emailTheme.findMany({ where, orderBy: { createdAt: "desc" } });
  return apiOk({
    themes: themes.map((th) => ({
      id: th.id,
      userId: th.userId,
      name: th.name,
      templateId: th.templateId,
      isPro: th.isPro,
      isActive: th.isActive,
      purpose: th.purpose,
      config: JSON.parse(th.config),
      createdAt: th.createdAt,
      updatedAt: th.updatedAt,
      // Whether the current requester can modify this theme (ownership).
      canModify: auth.mode === "admin" || th.userId === auth.userId,
    })),
  });
}
