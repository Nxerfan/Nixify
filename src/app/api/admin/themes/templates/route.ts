import { apiOk, apiError } from "@/lib/api-response";
import { resolveThemesViewer } from "@/lib/themes-auth";
import { TEMPLATES } from "@/lib/email-themes/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/themes/templates — list all 20 templates (free + pro).
 *  Access: any authenticated user (admin OR user session). */
export async function GET() {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  return apiOk({
    templates: TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      isPro: t.isPro,
      description: t.description,
      // Include the default config so the editor can pre-fill.
      config: t.config,
    })),
  });
}
