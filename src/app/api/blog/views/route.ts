import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security";
import { z } from "zod";
import { parseBody } from "@/lib/http";
import { recordArticleView } from "@/lib/blog/view-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const viewSchema = z.object({
  slug: z.string().min(1).max(200),
});

/**
 * POST /api/blog/views
 * Public (anonymous + authenticated). Records a real, deduped view.
 *
 * Dedup is per (ipHash, slug) per 30-min window — rapid refreshes don't
 * inflate counts. Authenticated users have their userId stored (survives as
 * a null FK after account deletion via SET NULL).
 */
export async function POST(req: NextRequest) {
  const [data, err] = await parseBody(req as any, viewSchema);
  if (err) return err;

  // Resolve the optional authenticated user (NOT required — anonymous views
  // count too).
  const user = await getAuthenticatedUser();
  const ip = getClientIp(req as any);

  const result = await recordArticleView({
    slug: data.slug,
    userId: user?.id ?? null,
    ip,
  });

  return apiOk(result);
}
