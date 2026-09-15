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
import { unsubscribeContact, newIdempotencyKey, CONSENT_SOURCES } from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reason: z.string().trim().max(200).optional(),
  idempotency_key: z.string().trim().min(8).max(128).optional(),
});

function extractId(req: NextRequest): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  // /api/v1/contacts/{id}/unsubscribe
  const idStr = parts[parts.length - 2];
  const id = Number(idStr);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * POST /api/v1/contacts/:id/unsubscribe
 *
 * Explicitly unsubscribe a contact. Idempotent when `idempotency_key` is provided.
 */
export const POST = withApiKey("full", async (ctx: ApiContext, req: NextRequest) => {
  if (!ctx.apiKey.userId) {
    return errorResponse(
      ctx.requestId,
      403,
      "feature_not_available",
      "This API key cannot manage Contacts. Use a user-owned API key.",
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

  const id = extractId(req);
  if (!id) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid contact ID.", req, ctx.apiKey.keyId);
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const json = await req.json().catch(() => ({}));
    const result = bodySchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i) => i.message).join("; ");
      return errorResponse(ctx.requestId, 400, "validation_failed", msg, req, ctx.apiKey.keyId);
    }
    body = result.data;
  } catch {
    body = {};
  }

  try {
    const result = await unsubscribeContact({
      userId: ctx.apiKey.userId,
      contactId: id,
      source: CONSENT_SOURCES.API,
      reason: body.reason,
      idempotencyKey: body.idempotency_key ?? newIdempotencyKey(),
      requestId: ctx.requestId,
    });

    if (result.contactNotFound) {
      return errorResponse(ctx.requestId, 404, "contact_not_found", "Contact not found.", req, ctx.apiKey.keyId);
    }

    return okResponse(ctx.requestId, {
      contact_id: id,
      marketing_status: result.newStatus,
      status: result.status,
      event_id: result.eventId,
    });
  } catch (err) {
    console.error("[v1/unsubscribe] error", err instanceof Error ? err.message : err);
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to unsubscribe contact.", req, ctx.apiKey.keyId);
  }
});
