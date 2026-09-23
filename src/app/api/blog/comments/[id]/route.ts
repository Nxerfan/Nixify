import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { parseBody } from "@/lib/http";
import { z } from "zod";
import { editComment, deleteComment, validateCommentBody } from "@/lib/blog/comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const editSchema = z.object({
  body: z.string().min(1),
});

/**
 * PATCH /api/blog/comments/[id]
 * Authenticated — edit OWN comment only. Ownership is checked server-side
 * (where clause scopes by BOTH id AND userId).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

/**
 * DELETE /api/blog/comments/[id]
 * Authenticated — delete OWN comment only. Cascades to replies.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Sign in to delete a comment.", 401);
  }
  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid comment id.", 400);
  }
  const ok = await deleteComment({ commentId, userId: user.id });
  if (!ok) {
    return apiError(ERROR_CODES.NOT_FOUND, "Comment not found or not owned by you.", 404);
  }
  return apiOk({ deleted: true });
}
