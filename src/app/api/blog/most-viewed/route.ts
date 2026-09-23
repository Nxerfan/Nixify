import { apiOk } from "@/lib/api-response";
import { getMostViewedArticles } from "@/lib/blog/view-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/blog/most-viewed
 * Public — top articles by REAL view count. No fabrication.
 */
export async function GET() {
  const articles = await getMostViewedArticles(5);
  return apiOk({ articles });
}
