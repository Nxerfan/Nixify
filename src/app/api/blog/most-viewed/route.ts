import { apiOk } from "@/lib/api-response";
import { getMostViewedArticles } from "@/lib/blog/view-metrics";
import { safeDb } from "@/lib/blog/safe-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/blog/most-viewed
 * Public — top articles by REAL view count. No fabrication. Returns an empty
 * list (not 500) when the DB is unavailable.
 */
export async function GET() {
  const articles = await safeDb(() => getMostViewedArticles(5), []);
  return apiOk({ articles });
}
