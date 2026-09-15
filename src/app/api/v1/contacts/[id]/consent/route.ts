import { NextRequest } from "next/server";
import {
  withApiKey,
  okResponse,
  errorResponse,
  type ApiContext,
} from "@/lib/dx/request-context";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getConsentSummary, getConsentHistory } from "@/lib/consent/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkAccess(ctx: ApiContext, req: NextRequest) {
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
  return null;
}

function extractId(req: NextRequest): number | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  // /api/v1/contacts/{id}/consent
  const idStr = parts[parts.length - 2]; // -1 is "consent", -2 is the id
  const id = Number(idStr);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * GET /api/v1/contacts/:id/consent
 *
 * Read-only consent + suppression + eligibility state. `read_only` API keys
 * may use this endpoint (per Phase 9 scope model: GET → "read" scope).
 *
 * Does NOT consume OTP_EMAILS or MESSAGING_EMAILS — consent operations are
 * part of API_MESSAGES (the existing v1 entitlement, enforced by withApiKey).
 */
export const GET = withApiKey("read", async (ctx: ApiContext, req: NextRequest) => {
  const accessErr = await checkAccess(ctx, req);
  if (accessErr) return accessErr;

  const id = extractId(req);
  if (!id) {
    return errorResponse(ctx.requestId, 400, "validation_failed", "Invalid contact ID.", req, ctx.apiKey.keyId);
  }

  const summary = await getConsentSummary(ctx.apiKey.userId!, id);
  if (!summary) {
    return errorResponse(ctx.requestId, 404, "contact_not_found", "Contact not found.", req, ctx.apiKey.keyId);
  }

  const { events } = await getConsentHistory(ctx.apiKey.userId!, id, { limit: 20 });

  return okResponse(ctx.requestId, {
    contact_id: summary.contactId,
    marketing_status: summary.marketingStatus,
    marketing_consent_source: summary.marketingConsentSource,
    marketing_consent_at: summary.marketingConsentAt?.toISOString() ?? null,
    suppressed: summary.suppressed,
    suppression_reason: summary.suppressionReason,
    suppression_source: summary.suppressionSource,
    suppression_lifted_at: summary.suppressionLiftedAt?.toISOString() ?? null,
    eligible: summary.eligible,
    history: events.map((e) => ({
      event_id: e.eventId,
      previous_status: e.previousStatus,
      new_status: e.newStatus,
      source: e.source,
      reason: e.reason,
      created_at: e.createdAt.toISOString(),
    })),
  });
});
