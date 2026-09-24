import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { adminDeleteComment } from "@/lib/blog/comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/comments/[id]
 * Admin only — permanently delete a comment.
 *
 * Blocker 3: if the comment has replies, it is TOMBSTONED (soft-deleted)
 * rather than hard-deleted, so the thread structure is preserved. A leaf
 * comment is hard-deleted. Never destroys other users' replies.
 *
 * Blocker 4: the tombstone label's locale is derived from the comment's
 * ACTUAL locale in the DB. No client-supplied locale is accepted.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid comment id.", 400);
  }
  // Blocker 4: NO client-supplied locale. adminDeleteComment fetches the
  // comment's authoritative locale from the DB.
  const result = await adminDeleteComment(commentId);
  if (!result.hardDeleted && !result.softDeleted) {
    return apiError(ERROR_CODES.NOT_FOUND, "Comment not found.", 404);
  }
  return apiOk(result);
}
