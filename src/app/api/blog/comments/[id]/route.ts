import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { z } from "zod";
import { parseBody } from "@/lib/http";
import {
  editComment,
  deleteComment,
  validateCommentBody,
} from "@/lib/blog/comments";
import { isSupportedLocale, type Locale } from "@/lib/i18n/locales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const editSchema = z.object({
  body: z.string().min(1),
});

/**
 * PATCH /api/blog/comments/[id]
 * Authenticated — edit OWN comment only. Ownership is checked server-side
 * (where clause scopes by BOTH id AND userId). A soft-deleted tombstone cannot
 * be edited.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { getAuthenticatedUser } = await import("@/lib/auth/session");
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Sign in to edit a comment.", 401);
  }
  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid comment id.", 400);
  }
  const [data, err] = await parseBody(req as any, editSchema);
  if (err) return err;
  const bodyResult = validateCommentBody(data.body);
  if (!bodyResult.ok) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, bodyResult.error, 400);
  }
  const updated = await editComment({
    commentId,
    userId: user.id,
    body: bodyResult.value,
  });
  if (!updated) {
    return apiError(ERROR_CODES.NOT_FOUND, "Comment not found or not owned by you.", 404);
  }
  return apiOk({ comment: updated });
}

const deleteSchema = z.object({
  // locale is required so the tombstone label (if soft-delete) is localized.
  locale: z.string().refine(isSupportedLocale, "locale must be en or fa"),
});

/**
 * DELETE /api/blog/comments/[id]
 * Authenticated — delete OWN comment only.
 *
 * Blocker 3 — preserved-thread tombstone:
 *   • If the comment has replies (owned by any user), it is SOFT-DELETED
 *     (tombstoned) — body cleared, authorName → localized tombstone, userId
 *     nulled. The row + replies survive.
 *   • If the comment is a leaf, it is HARD-DELETED.
 *   • NEVER destroys other users' replies.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { getAuthenticatedUser } = await import("@/lib/auth/session");
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Sign in to delete a comment.", 401);
  }
  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid comment id.", 400);
  }
  // Parse the locale from the body (the client knows which thread it's in).
  const [data, err] = await parseBody(req as any, deleteSchema);
  if (err) return err;
  const locale = data.locale as Locale;
  const result = await deleteComment({ commentId, userId: user.id, locale });
  if (!result.hardDeleted && !result.softDeleted) {
    return apiError(ERROR_CODES.NOT_FOUND, "Comment not found or not owned by you.", 404);
  }
  return apiOk(result);
}
