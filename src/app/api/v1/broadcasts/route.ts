import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withApiKey,
  okResponse,
  errorResponse,
  type ApiContext,
} from "@/lib/dx/request-context";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import {
  createBroadcast,
  listBroadcasts,
  BroadcastValidationError,
} from "@/lib/broadcasts/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(200),
  htmlContent: z.string().min(1),
  textContent: z.string().nullable().optional(),
  audienceType: z.enum(["all_contacts", "group"]),
  targetGroupId: z.number().int().positive().nullable().optional(),
});

export const GET = withApiKey("read", async (ctx: ApiContext, req: NextRequest) => {
  if (!ctx.apiKey.userId) return errorResponse(ctx.requestId, 403, "feature_not_available", "User-owned key required.", req, ctx.apiKey.keyId);
  const access = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return errorResponse(ctx.requestId, 403, "feature_not_available", "Broadcasts not available on your plan.", req, ctx.apiKey.keyId);

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const status = url.searchParams.get("status") ?? undefined;

  const result = await listBroadcasts(ctx.apiKey.userId, {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    status: status || undefined,
  });

  return okResponse(ctx.requestId, {
    broadcasts: result.broadcasts,
    total: result.total,
    page: result.page,
    page_size: result.pageSize,
  });
});

export const POST = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  if (!ctx.apiKey.userId) return errorResponse(ctx.requestId, 403, "feature_not_available", "User-owned key required.", req, ctx.apiKey.keyId);
  const access = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) return errorResponse(ctx.requestId, 403, "feature_not_available", "Broadcasts not available on your plan.", req, ctx.apiKey.keyId);

  let body: z.infer<typeof createSchema>;
  try {
    const json = await req.json();
    const result = createSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return errorResponse(ctx.requestId, 400, "validation_failed", msg, req, ctx.apiKey.keyId);
    }
    body = result.data;
  } catch {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid JSON body.", req, ctx.apiKey.keyId);
  }

  try {
    const broadcast = await createBroadcast({
      userId: ctx.apiKey.userId,
      name: body.name,
      subject: body.subject,
      htmlContent: body.htmlContent,
      textContent: body.textContent ?? null,
      audienceType: body.audienceType,
      targetGroupId: body.targetGroupId ?? null,
    });
    return okResponse(ctx.requestId, broadcast, 201);
  } catch (err) {
    if (err instanceof BroadcastValidationError) {
      return errorResponse(ctx.requestId, 400, "validation_failed", err.message, req, ctx.apiKey.keyId);
    }
    console.error("[v1/broadcasts] safe_error_code: internal_error");
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to create broadcast.", req, ctx.apiKey.keyId);
  }
});
