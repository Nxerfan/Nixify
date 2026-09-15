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
  listSuppressions,
  suppressEmail,
  CONSENT_SOURCES,
  SUPPRESSION_REASONS,
  IdempotencyConflictError,
} from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  email: z.string().trim().max(254).min(3),
  reason: z.enum(["unsubscribe", "manual"]).default("manual"),
});

function extractIdempotencyKey(req: NextRequest): string | null {
  const raw = req.headers.get("idempotency-key");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return trimmed;
}

/**
 * GET /api/v1/suppressions?page=1&pageSize=20&activeOnly=true&search=foo
 *
 * Read-only list — `read_only` API keys may use this.
 */
export const GET = withApiKey("read", async (ctx: ApiContext, req: NextRequest) => {
  if (!ctx.apiKey.userId) {
    return errorResponse(
      ctx.requestId,
      403,
      "feature_not_available",
      "This API key cannot manage suppressions. Use a user-owned API key.",
      req,
      ctx.apiKey.keyId,
    );
  }
  const access = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return errorResponse(
      ctx.requestId,
      403,
      "feature_not_available",
      "Contacts is not available on your plan.",
      req,
      ctx.apiKey.keyId,
    );
  }

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const activeOnly = url.searchParams.get("activeOnly") === "true";
  const search = url.searchParams.get("search") ?? undefined;

  const result = await listSuppressions(ctx.apiKey.userId, {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    activeOnly,
    search: search || undefined,
  });

  return okResponse(ctx.requestId, {
    suppressions: result.suppressions.map((s) => ({
      id: s.id,
      suppression_id: s.suppressionId,
      email: s.email,
      reason: s.reason,
      source: s.source,
      active: s.active,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
      lifted_at: s.liftedAt?.toISOString() ?? null,
    })),
    total: result.total,
    page: result.page,
    page_size: result.pageSize,
  });
});

/**
 * POST /api/v1/suppressions
 * Body: { email, reason?: "manual"|"unsubscribe" (default "manual") }
 *
 * Uses standard `Idempotency-Key` header.
 */
export const POST = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  if (!ctx.apiKey.userId) {
    return errorResponse(
      ctx.requestId,
      403,
      "feature_not_available",
      "This API key cannot manage suppressions. Use a user-owned API key.",
      req,
      ctx.apiKey.keyId,
    );
  }
  const access = await canAccess(ctx.apiKey.userId, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return errorResponse(
      ctx.requestId,
      403,
      "feature_not_available",
      "Contacts is not available on your plan.",
      req,
      ctx.apiKey.keyId,
    );
  }

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

  const idempotencyKey = extractIdempotencyKey(req);

  try {
    const result = await suppressEmail({
      userId: ctx.apiKey.userId,
      email: body.email,
      reason: body.reason === "unsubscribe" ? SUPPRESSION_REASONS.UNSUBSCRIBE : SUPPRESSION_REASONS.MANUAL,
      source: CONSENT_SOURCES.API,
      idempotencyKey: idempotencyKey ?? undefined,
      requestId: ctx.requestId,
      requestPayload: { email: body.email, reason: body.reason },
    });

    return okResponse(ctx.requestId, {
      suppression_id: result.suppressionId,
      email: result.email,
      active: result.active,
      status: result.status,
      event_id: result.eventId,
    }, 201);
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return errorResponse(
        ctx.requestId,
        409,
        "idempotency_conflict",
        "Idempotency key reused with conflicting request payload.",
        req,
        ctx.apiKey.keyId,
      );
    }
    const msg = err instanceof Error ? err.message : "Failed to suppress email.";
    const code = msg.includes("Invalid email") ? "validation_failed" : "internal_error";
    if (code === "internal_error") {
      console.error("[v1/suppressions] safe_error_code: internal_error");
    }
    return errorResponse(
      ctx.requestId,
      code === "validation_failed" ? 400 : 500,
      code,
      code === "validation_failed" ? msg : "Failed to suppress email.",
      req,
      ctx.apiKey.keyId,
    );
  }
});
