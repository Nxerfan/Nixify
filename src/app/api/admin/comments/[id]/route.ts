import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { adminDeleteComment } from "@/lib/blog/comments";
import { isSupportedLocale, type Locale } from "@/lib/i18n/locales";
import { z } from "zod";
import { parseBody } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deleteSchema = z.object({
  // locale is required so the tombstone label (if soft-delete) is localized.
  locale: z.string().refine(isSupportedLocale, "locale must be en or fa"),
});

/**
 * DELETE /api/admin/comments/[id]
 * Admin only — permanently delete a comment.
 *
 * Blocker 3: if the comment has replies, it is TOMBSTONED (soft-deleted)
 * rather than hard-deleted, so the thread structure is preserved. A leaf
 * comment is hard-deleted. Never destroys other users' replies.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid comment id.", 400);
  }
  // Parse the locale for the tombstone label.
  const [data, err] = await parseBody(req as any, deleteSchema);
  if (err) return err;
  const locale = data.locale as Locale;
  const result = await adminDeleteComment(commentId, locale);
  if (!result.hardDeleted && !result.softDeleted) {
    return apiError(ERROR_CODES.NOT_FOUND, "Comment not found.", 404);
  }
  return apiOk(result);
}
