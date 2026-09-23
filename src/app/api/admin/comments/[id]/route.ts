import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { adminDeleteComment, hideComment, unhideComment } from "@/lib/blog/comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/admin/comments/[id]
 * Admin only — permanently delete a comment (cascades to replies).
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
  const ok = await adminDeleteComment(commentId);
  if (!ok) return apiError(ERROR_CODES.NOT_FOUND, "Comment not found.", 404);
  return apiOk({ deleted: true });
}
