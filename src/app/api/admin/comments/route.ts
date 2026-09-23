import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { adminListComments, COMMENT_PAGE_SIZE } from "@/lib/blog/comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/comments?slug=X&hidden=true|false&page=N
 * Admin only — list ALL comments (including hidden) for moderation.
 */
export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || undefined;
  const hiddenParam = url.searchParams.get("hidden");
  const hidden = hiddenParam === "true" ? true : hiddenParam === "false" ? false : undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const result = await adminListComments({ slug, hidden, page });
  return apiOk(result);
}
