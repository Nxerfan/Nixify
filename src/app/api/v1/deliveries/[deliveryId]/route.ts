import { NextRequest } from "next/server";
import {
  withApiKey,
  okResponse,
  errorResponse,
  type ApiContext,
} from "@/lib/dx/request-context";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getDelivery } from "@/lib/deliverability/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/deliveries/:deliveryId
 *
 * Read-only detail view of a single EmailDelivery + its full event history.
 * Tenant-scoped — 404 if the delivery belongs to another user.
 *
 * The deliveryId is parsed from the URL because withApiKey wraps a
 * (ctx, req) handler signature, not the (req, { params }) signature used
 * by dashboard routes.
 */
function extractDeliveryId(req: NextRequest): string | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  // /api/v1/deliveries/{deliveryId} → last is the UUID.
  return last && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(last) ? last : null;
}

export const GET = withApiKey("read", async (ctx: ApiContext, req: NextRequest) => {
  if (!ctx.apiKey.userId) {
    return errorResponse(
      ctx.requestId,
      403,
      "owner_required",
      "User-owned API key required.",
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
      "Deliverability API not available on your plan.",
      req,
      ctx.apiKey.keyId,
    );
  }

  const deliveryId = extractDeliveryId(req);
  if (!deliveryId) {
    return errorResponse(
      ctx.requestId,
      400,
      "validation_failed",
      "Invalid delivery id.",
      req,
      ctx.apiKey.keyId,
    );
  }

  const delivery = await getDelivery(ctx.apiKey.userId, deliveryId);
  if (!delivery) {
    return errorResponse(
      ctx.requestId,
      404,
      "not_found",
      "Delivery not found.",
      req,
      ctx.apiKey.keyId,
    );
  }

  return okResponse(ctx.requestId, { delivery });
});
