import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { unhideComment } from "@/lib/blog/comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/comments/[id]/unhide
 * Admin only — unhide a comment (restore public display).
 */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid comment id.", 400);
  }
  const ok = await unhideComment(commentId, Number(admin.sub));
  if (!ok) return apiError(ERROR_CODES.NOT_FOUND, "Comment not found.", 404);
  return apiOk({ hidden: false });
}
