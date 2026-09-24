import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { z } from "zod";
import { parseBody } from "@/lib/http";
import {
  listComments,
  createComment,
  validateCommentBody,
  resolveAuthorName,
  enforceCommentPostLimits,
  CommentError,
  isValidArticleSlug,
} from "@/lib/blog/comments";
import { isSupportedLocale, type Locale } from "@/lib/i18n/locales";
import { safeDb } from "@/lib/blog/safe-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listSchema = z.object({
  slug: z.string().min(1).max(200),
  locale: z.string().refine(isSupportedLocale, "locale must be en or fa"),
  page: z.coerce.number().int().positive().optional(),
});

/**
 * GET /api/blog/comments?slug=X&locale=en&page=Y
 * Public — list top-level comments (hidden excluded, subtree policy) for an
 * article in a specific locale thread. Locale is REQUIRED (Blocker 1) — EN
 * and FA threads do not mix.
 *
 * Anonymous users can read.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const localeRaw = url.searchParams.get("locale");
  if (!slug) return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing ?slug=", 400);
  if (!localeRaw || !isSupportedLocale(localeRaw)) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing or invalid ?locale= (must be en or fa).", 400);
  }
  const locale = localeRaw as Locale;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  // Degrade gracefully when the DB is unavailable (e.g. during build without
  // DATABASE_URL) — return an empty list rather than 500.
  const result = await safeDb(() => listComments(slug, locale, page), {
    comments: [],
    topLevelCount: 0,
    totalVisibleCount: 0,
    hasMore: false,
  });
  return apiOk(result);
}

const createSchema = z.object({
  slug: z.string().min(1).max(200),
  locale: z.string().refine(isSupportedLocale, "locale must be en or fa"),
  body: z.string().min(1),
  parentId: z.number().int().positive().optional().nullable(),
});

/**
 * POST /api/blog/comments
 * Authenticated only — anonymous posting is not allowed.
 *
 * Blocker 1: locale is REQUIRED and partitions the thread.
 * Blocker 2: (slug, locale) must be a real published article.
 * Blocker 4: parentId (if provided) must refer to a TOP-LEVEL comment in the
 *            same (slug, locale) thread — one reply level only.
 */
export async function POST(req: NextRequest) {
  // Lazy import to avoid pulling the session/DB into the GET path.
  const { getAuthenticatedUser } = await import("@/lib/auth/session");
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Sign in to post a comment.", 401);
  }

  const [data, err] = await parseBody(req as any, createSchema);
  if (err) return err;

  const locale = data.locale as Locale;

  // Blocker 2: verify the article exists in the canonical corpus for this
  // locale before accepting a comment.
  if (!isValidArticleSlug(data.slug, locale)) {
    return apiError(ERROR_CODES.NOT_FOUND, "Article not found for this locale.", 404);
  }

  // Validate + normalize the body (plain text, no HTML, length limits).
  const bodyResult = validateCommentBody(data.body);
  if (!bodyResult.ok) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, bodyResult.error, 400);
  }

  // Rate limit: per-user comment-post limits.
  const rl = await enforceCommentPostLimits(user.id);
  if (!rl.allowed) {
    return apiError(
      ERROR_CODES.RATE_LIMITED,
      `Too many comments. Retry in ${rl.retryAfterSeconds}s.`,
      429,
    );
  }

  // createComment enforces nesting depth + cross-locale parent rejection.
  try {
    const created = await createComment({
      slug: data.slug,
      locale,
      userId: user.id,
      authorName: resolveAuthorName(user, locale),
      body: bodyResult.value,
      parentId: data.parentId ?? null,
    });
    return apiOk({ comment: created }, 201);
  } catch (e) {
    if (e instanceof CommentError) {
      return apiError(e.code as typeof ERROR_CODES[keyof typeof ERROR_CODES], e.message, e.status);
    }
    throw e;
  }
}
