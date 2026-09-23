import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { adminListComments } from "@/lib/blog/comments";
import { isSupportedLocale, type Locale } from "@/lib/i18n/locales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/comments?slug=X&locale=en&hidden=true|false&page=N
 * Admin only — list ALL comments (including hidden + deleted tombstones) for
 * moderation. Optional filters: slug, locale, hidden status. Paginated.
 */
export async function GET(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || undefined;
  const localeRaw = url.searchParams.get("locale");
  const locale = localeRaw && isSupportedLocale(localeRaw) ? (localeRaw as Locale) : undefined;
  const hiddenParam = url.searchParams.get("hidden");
  const hidden = hiddenParam === "true" ? true : hiddenParam === "false" ? false : undefined;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const result = await adminListComments({ slug, locale, hidden, page });
  return apiOk(result);
}
