import { NextRequest } from "next/server";
import { withApiKey, okResponse, errorResponse, type ApiContext } from "@/lib/dx/request-context";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { cancelBroadcast, BroadcastValidationError, IdempotencyConflictError } from "@/lib/broadcasts/service";
import { IDEMPOTENCY_KEY_MIN, IDEMPOTENCY_KEY_MAX } from "@/lib/broadcasts/constants";

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
  const broadcastId = parts[parts.length - 2];
  if (!broadcastId) return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid broadcast ID.", req, ctx.apiKey.keyId);

  // Idempotency-Key header (8-128 chars). Optional for v1 cancel.
  const idempotencyKey = req.headers.get("idempotency-key") ?? undefined;
  if (idempotencyKey !== undefined && (idempotencyKey.length < IDEMPOTENCY_KEY_MIN || idempotencyKey.length > IDEMPOTENCY_KEY_MAX)) {
    return errorResponse(ctx.requestId, 400, "validation_failed", `Idempotency-Key must be ${IDEMPOTENCY_KEY_MIN}-${IDEMPOTENCY_KEY_MAX} chars.`, req, ctx.apiKey.keyId);
  }

  try {
    const result = await cancelBroadcast(ctx.apiKey.userId, broadcastId, { idempotencyKey });
    return okResponse(ctx.requestId, result);
  } catch (e) {
    if (e instanceof IdempotencyConflictError) return errorResponse(ctx.requestId, 409, "idempotency_conflict", e.message, req, ctx.apiKey.keyId);
    if (e instanceof BroadcastValidationError) return errorResponse(ctx.requestId, 400, "validation_failed", e.message, req, ctx.apiKey.keyId);
    console.error("[v1/broadcasts/cancel] safe_error_code: internal_error");
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to cancel broadcast.", req, ctx.apiKey.keyId);
  }
});
