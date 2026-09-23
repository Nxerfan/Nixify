import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { listDeliveries } from "@/lib/deliverability/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/deliveries
 *
 * Paginated list of EmailDelivery rows for the authenticated user.
 *
 * Filters (all optional, query params):
 *   - sourceType ("broadcast" | "transactional" | "otp")
 *   - status    (queued | provider_accepted | delivered | deferred | bounced | complained | rejected | failed)
 *   - provider   ("smtp" | future ESPs)
 *   - page, pageSize (default 1, 20)
 *
 * Tenant-scoped — only returns deliveries for the authenticated user.
 *
 * Access: requires CONTACTS feature (deliverability is a contacts-adjacent
 * capability). Future plans may have a separate DELIVERABILITY feature key.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }
  const access = await canAccess(user.id, FEATURE_KEYS.CONTACTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Deliverability dashboard not available." } },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  const sourceType = url.searchParams.get("sourceType") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const provider = url.searchParams.get("provider") ?? undefined;

  const result = await listDeliveries(user.id, {
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    sourceType: sourceType || undefined,
    status: status || undefined,
    provider: provider || undefined,
  });

  return NextResponse.json({
    deliveries: result.deliveries,
    total: result.total,
    page: result.page,
    page_size: result.pageSize,
  });
}
