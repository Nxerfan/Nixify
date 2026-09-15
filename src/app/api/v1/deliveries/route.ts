import { NextRequest } from "next/server";
import {
  withApiKey,
  okResponse,
  errorResponse,
  type ApiContext,
} from "@/lib/dx/request-context";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { listDeliveries } from "@/lib/deliverability/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/deliveries
 *
 * Read-only v1 API for EmailDelivery rows. Requires `read` scope.
 * API_MESSAGES quota is consumed by the withApiKey middleware (entitlement
 * check) — preserved per Phase 4 contract.
 *
 * Filters (all optional, query params):
 *   - sourceType ("broadcast" | "transactional" | "otp")
 *   - status    (queued | provider_accepted | delivered | deferred | bounced | complained | rejected | failed)
 *   - provider   ("smtp" | future ESPs)
 *   - page, pageSize (default 1, 20)
 *
 * Tenant-scoped — returns deliveries owned by the API key's user only.
 * System keys (userId=null) → 403 owner_required (deliverability is per-user).
 */
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

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const sourceType = url.searchParams.get("sourceType") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const provider = url.searchParams.get("provider") ?? undefined;

  const result = await listDeliveries(ctx.apiKey.userId, {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    sourceType: sourceType || undefined,
    status: status || undefined,
    provider: provider || undefined,
  });

  return okResponse(ctx.requestId, {
    deliveries: result.deliveries,
    total: result.total,
    page: result.page,
    page_size: result.pageSize,
  });
});
