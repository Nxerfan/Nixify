import { apiOk } from "@/lib/api-response";
import { getMostDiscussedArticles } from "@/lib/blog/comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/blog/most-discussed
 * Public — top articles by REAL visible comment count. No fabrication.
 */
export async function GET() {
  const articles = await getMostDiscussedArticles(5);
  return apiOk({ articles });
}
