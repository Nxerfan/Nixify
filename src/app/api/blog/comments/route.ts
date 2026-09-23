import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getClientIp } from "@/lib/security";
import { z } from "zod";
import { parseBody } from "@/lib/http";
import {
  listComments,
  createComment,
  validateCommentBody,
  resolveAuthorName,
  enforceCommentPostLimits,
} from "@/lib/blog/comments";
import { isSupportedLocale } from "@/lib/i18n/locales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/blog/comments?slug=X&page=Y
 * Public — list top-level comments (hidden excluded) for an article.
 * Anonymous users can read.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing ?slug=", 400);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const result = await listComments(slug, page);
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
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Sign in to post a comment.", 401);
  }

  const [data, err] = await parseBody(req as any, createSchema);
  if (err) return err;

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

  // If a parentId is provided, verify the parent exists, is not hidden, and
  // belongs to the same slug (so a reply can't be cross-posted to an
  // unrelated article).
  if (data.parentId) {
    const { db } = await import("@/lib/db");
    const parent = await db.blogComment.findUnique({
      where: { id: data.parentId! },
      select: { slug: true, hidden: true },
    });
    if (!parent || parent.hidden) {
      return apiError(ERROR_CODES.NOT_FOUND, "Parent comment not found.", 404);
    }
    if (parent.slug !== data.slug) {
      return apiError(ERROR_CODES.VALIDATION_FAILED, "Parent comment does not belong to this article.", 400);
    }
  }

  const created = await createComment({
    slug: data.slug,
    locale: data.locale,
    userId: user.id,
    authorName: resolveAuthorName(user),
    body: bodyResult.value,
    parentId: data.parentId ?? null,
  });

  return apiOk({ comment: created }, 201);
}
