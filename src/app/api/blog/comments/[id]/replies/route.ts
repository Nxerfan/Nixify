import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { listReplies } from "@/lib/blog/comments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/blog/comments/[id]/replies
 * Public — list direct replies to a comment (one level, hidden excluded).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parentId = Number(id);
  if (!Number.isInteger(parentId) || parentId <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Invalid comment id.", 400);
  }
  const replies = await listReplies(parentId);
  return apiOk({ replies });
}
