import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiKey, okResponse, errorResponse, type ApiContext } from "@/lib/dx/request-context";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { launchBroadcast, BroadcastValidationError } from "@/lib/broadcasts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const launchSchema = z.object({
  scheduledAt: z.string().datetime().nullable().optional(),
});

export const POST = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  if (!ctx.apiKey.userId) return errorResponse(ctx.requestId, 403, "feature_not_available", "User-owned key required.", req, ctx.apiKey.keyId);
  const access = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return errorResponse(ctx.requestId, 403, "feature_not_available", "Broadcasts not available.", req, ctx.apiKey.keyId);

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const broadcastId = parts[parts.length - 2];
  if (!broadcastId) return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid broadcast ID.", req, ctx.apiKey.keyId);

  let body: z.infer<typeof launchSchema> = {};
  try {
    const json = await req.json().catch(() => ({}));
    const result = launchSchema.safeParse(json);
    if (result.success) body = result.data;
  } catch { /* empty body is fine */ }

  try {
    const result = await launchBroadcast(ctx.apiKey.userId, broadcastId, {
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
    });
    return okResponse(ctx.requestId, result);
  } catch (e) {
    if (e instanceof BroadcastValidationError) return errorResponse(ctx.requestId, 400, "validation_failed", e.message, req, ctx.apiKey.keyId);
    console.error("[v1/broadcasts/launch] safe_error_code: internal_error");
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to launch broadcast.", req, ctx.apiKey.keyId);
  }
});
