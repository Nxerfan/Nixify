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
  unsuppressByPublicId,
  getSuppressionByPublicId,
  CONSENT_SOURCES,
  IdempotencyConflictError,
} from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const liftSchema = z.object({
  also_subscribe: z.boolean().default(false),
});

function extractIdempotencyKey(req: NextRequest): string | null {
  const raw = req.headers.get("idempotency-key");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return trimmed;
}

/**
 * GET /api/v1/suppressions/:suppressionId
 *
 * Read-only fetch — `read_only` API keys may use this.
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

  const suppressionId = extractSuppressionId(req);
  if (!suppressionId) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid suppression ID.", req, ctx.apiKey.keyId);
  }

  const entry = await getSuppressionByPublicId(ctx.apiKey.userId, suppressionId);
  if (!entry) {
    return errorResponse(ctx.requestId, 404, "suppression_not_found", "Suppression entry not found.", req, ctx.apiKey.keyId);
  }

  return okResponse(ctx.requestId, {
    id: entry.id,
    suppression_id: entry.suppressionId,
    email: entry.email,
    reason: entry.reason,
    source: entry.source,
    active: entry.active,
    created_at: entry.createdAt.toISOString(),
    updated_at: entry.updatedAt.toISOString(),
    lifted_at: entry.liftedAt?.toISOString() ?? null,
  });
});

/**
 * DELETE /api/v1/suppressions/:suppressionId
 *
 * Lift (deactivate) a suppression entry. Idempotent — repeated DELETE calls
 * on an already-lifted entry return 200 with status="not_suppressed".
 *
 * Body (optional): { also_subscribe?: boolean }
 * Uses standard `Idempotency-Key` header.
 */
export const DELETE = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
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

  const suppressionId = extractSuppressionId(req);
  if (!suppressionId) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid suppression ID.", req, ctx.apiKey.keyId);
  }

  let body: z.infer<typeof liftSchema>;
  try {
    const json = await req.json().catch(() => ({}));
    const result = liftSchema.safeParse(json);
    if (!result.success) {
      body = { also_subscribe: false };
    } else {
      body = result.data;
    }
  } catch {
    body = { also_subscribe: false };
  }

  const idempotencyKey = extractIdempotencyKey(req);

  try {
    const result = await unsuppressByPublicId(ctx.apiKey.userId, suppressionId, CONSENT_SOURCES.API, {
      alsoSubscribe: body.also_subscribe,
      idempotencyKey: idempotencyKey ?? undefined,
      requestId: ctx.requestId,
      requestPayload: { also_subscribe: body.also_subscribe },
    });

    if (result.status === "not_suppressed") {
      return errorResponse(
        ctx.requestId,
        404,
        "suppression_not_found",
        "Suppression entry not found or already lifted.",
        req,
        ctx.apiKey.keyId,
      );
    }

    return okResponse(ctx.requestId, {
      suppression_id: suppressionId,
      email: result.email,
      active: result.active,
      status: result.status,
      event_id: result.eventId,
    });
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
    console.error("[v1/suppressions/delete] safe_error_code: internal_error");
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to lift suppression.", req, ctx.apiKey.keyId);
  }
});

function extractSuppressionId(req: NextRequest): string | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // /api/v1/suppressions/{suppressionId}
  const last = parts[parts.length - 1];
  return last && last.length >= 8 && last.length <= 64 ? last : null;
}
