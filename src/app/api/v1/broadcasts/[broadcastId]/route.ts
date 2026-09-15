import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiKey, okResponse, errorResponse, type ApiContext } from "@/lib/dx/request-context";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getBroadcast, updateBroadcast, deleteBroadcast, listRecipients, BroadcastValidationError } from "@/lib/broadcasts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(200).optional(),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().nullable().optional(),
  audienceType: z.enum(["all_contacts", "group"]).optional(),
  targetGroupId: z.number().int().positive().nullable().optional(),
});

async function checkAccess(ctx: ApiContext, req: NextRequest) {
  if (!ctx.apiKey.userId) return errorResponse(ctx.requestId, 403, "feature_not_available", "User-owned key required.", req, ctx.apiKey.keyId);
  const access = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return errorResponse(ctx.requestId, 403, "feature_not_available", "Broadcasts not available.", req, ctx.apiKey.keyId);
  return null;
}

function extractBroadcastId(req: NextRequest): string | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  // /api/v1/broadcasts/{broadcastId} → last is broadcastId (or "recipients")
  if (parts[parts.length - 1] === "recipients") return parts[parts.length - 2] ?? null;
  return last && last.length >= 8 ? last : null;
}

export const GET = withApiKey("read", async (ctx: ApiContext, req: NextRequest) => {
  const err = await checkAccess(ctx, req);
  if (err) return err;
  const broadcastId = extractBroadcastId(req);
  if (!broadcastId) return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid broadcast ID.", req, ctx.apiKey.keyId);

  // Check if this is a recipients request
  if (req.url.includes("/recipients")) {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
    const status = url.searchParams.get("status") ?? undefined;
    const result = await listRecipients(ctx.apiKey.userId!, broadcastId, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
      status: status || undefined,
    });
    if (!result) return errorResponse(ctx.requestId, 404, "broadcast_not_found", "Broadcast not found.", req, ctx.apiKey.keyId);
    return okResponse(ctx.requestId, {
      recipients: result.recipients,
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    });
  }

  const broadcast = await getBroadcast(ctx.apiKey.userId!, broadcastId);
  if (!broadcast) return errorResponse(ctx.requestId, 404, "broadcast_not_found", "Broadcast not found.", req, ctx.apiKey.keyId);
  return okResponse(ctx.requestId, broadcast);
});

export const PATCH = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  const err = await checkAccess(ctx, req);
  if (err) return err;
  const broadcastId = extractBroadcastId(req);
  if (!broadcastId) return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid broadcast ID.", req, ctx.apiKey.keyId);

  let body: z.infer<typeof updateSchema>;
  try {
    const json = await req.json();
    const result = updateSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return errorResponse(ctx.requestId, 400, "validation_failed", msg, req, ctx.apiKey.keyId);
    }
    body = result.data;
  } catch {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid JSON body.", req, ctx.apiKey.keyId);
  }

  try {
    const broadcast = await updateBroadcast(ctx.apiKey.userId!, broadcastId, body);
    if (!broadcast) return errorResponse(ctx.requestId, 404, "broadcast_not_found", "Broadcast not found.", req, ctx.apiKey.keyId);
    return okResponse(ctx.requestId, broadcast);
  } catch (e) {
    if (e instanceof BroadcastValidationError) return errorResponse(ctx.requestId, 400, "validation_failed", e.message, req, ctx.apiKey.keyId);
    console.error("[v1/broadcasts/patch] safe_error_code: internal_error");
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to update broadcast.", req, ctx.apiKey.keyId);
  }
});

export const DELETE = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  const err = await checkAccess(ctx, req);
  if (err) return err;
  const broadcastId = extractBroadcastId(req);
  if (!broadcastId) return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid broadcast ID.", req, ctx.apiKey.keyId);

  try {
    const deleted = await deleteBroadcast(ctx.apiKey.userId!, broadcastId);
    if (!deleted) return errorResponse(ctx.requestId, 404, "broadcast_not_found", "Broadcast not found.", req, ctx.apiKey.keyId);
    return okResponse(ctx.requestId, { deleted: true });
  } catch (e) {
    if (e instanceof BroadcastValidationError) return errorResponse(ctx.requestId, 400, "validation_failed", e.message, req, ctx.apiKey.keyId);
    console.error("[v1/broadcasts/delete] safe_error_code: internal_error");
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to delete broadcast.", req, ctx.apiKey.keyId);
  }
});
