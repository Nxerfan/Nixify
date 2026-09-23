import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getMostDiscussedArticles } from "@/lib/blog/comments";
import { isSupportedLocale, type Locale } from "@/lib/i18n/locales";
import { safeDb } from "@/lib/blog/safe-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/blog/most-discussed?locale=en
 * Public — top articles by REAL visible comment count, locale-aware
 * (Blocker 1). The FA blog homepage gets the most-discussed FA threads.
 *
 * `locale` is REQUIRED. Returns 400 if missing/invalid. Returns an empty list
 * (not 500) when the DB is unavailable.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const localeRaw = url.searchParams.get("locale");
  if (!localeRaw || !isSupportedLocale(localeRaw)) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing or invalid ?locale= (must be en or fa).", 400);
  }
  const locale = localeRaw as Locale;
  const articles = await safeDb(() => getMostDiscussedArticles(locale, 5), []);
  return apiOk({ articles });
}
