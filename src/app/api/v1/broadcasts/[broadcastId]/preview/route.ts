import { NextRequest } from "next/server";
import { withApiKey, okResponse, errorResponse, type ApiContext } from "@/lib/dx/request-context";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { previewBroadcast } from "@/lib/broadcasts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  if (!ctx.apiKey.userId) return errorResponse(ctx.requestId, 403, "feature_not_available", "User-owned key required.", req, ctx.apiKey.keyId);
  const access = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return errorResponse(ctx.requestId, 403, "feature_not_available", "Broadcasts not available.", req, ctx.apiKey.keyId);
  const bcastAccess = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.BROADCAST_EMAILS);
  if (!bcastAccess.allowed) return errorResponse(ctx.requestId, 403, "feature_not_available", "Broadcasts not available.", req, ctx.apiKey.keyId);

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const broadcastId = parts[parts.length - 2]; // /api/v1/broadcasts/{id}/preview
  if (!broadcastId) return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid broadcast ID.", req, ctx.apiKey.keyId);

  const preview = await previewBroadcast(ctx.apiKey.userId, broadcastId);
  if (!preview) return errorResponse(ctx.requestId, 404, "broadcast_not_found", "Broadcast not found.", req, ctx.apiKey.keyId);

  return okResponse(ctx.requestId, {
    total: preview.total,
    eligible: preview.eligible,
    unknown: preview.unknown,
    unsubscribed: preview.unsubscribed,
    suppressed: preview.suppressed,
  });
});
