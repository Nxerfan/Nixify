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
  subscribeContact,
  IdempotencyConflictError,
  CONSENT_SOURCES,
} from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

/**
 * Extract the standard Idempotency-Key header (8-128 chars, same convention
 * as transactional Send). Returns null if absent — null means no idempotency
 * key was supplied (the operation runs but is not deduped).
 */
function extractIdempotencyKey(req: NextRequest): string | null {
  const raw = req.headers.get("idempotency-key");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  return trimmed;
}

function extractId(req: NextRequest): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  // /api/v1/contacts/{id}/subscribe
  const idStr = parts[parts.length - 2];
  const id = Number(idStr);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * POST /api/v1/contacts/:id/subscribe
 *
 * Explicitly subscribe a contact. Mutations require the `full` scope.
 *
 * IDEMPOTENCY: uses the standard HTTP `Idempotency-Key` header (8-128 chars).
 * The same (tenant, operation, target, key) tuple is deduped — repeated
 * requests with the same key return idempotent_replay with the same eventId.
 * A key reused for a different operation/target/contact is NOT replayed.
 * A key reused with a conflicting request payload returns 409 idempotency_conflict.
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

  const idempotencyKey = extractIdempotencyKey(req);

  try {
    const result = await subscribeContact({
      userId: ctx.apiKey.userId,
      contactId: id,
      source: CONSENT_SOURCES.API,
      reason: body.reason,
      idempotencyKey: idempotencyKey ?? undefined,
      requestId: ctx.requestId,
      requestPayload: { reason: body.reason ?? null },
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
    // Safe error code only — never log raw exception text.
    console.error("[v1/subscribe] safe_error_code: internal_error");
    return errorResponse(ctx.requestId, 500, "internal_error", "Failed to subscribe contact.", req, ctx.apiKey.keyId);
  }
});
