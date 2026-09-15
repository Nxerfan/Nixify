import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/webhooks/:id/deliveries
 *
 * List delivery records for a webhook endpoint. Paginated. The response
 * exposes the public deliveryId (UUID) + status + timestamps + lastError
 * classification + responseCode. It NEVER exposes the signing secret,
 * signature, or payload (sensitive data — only the delivery detail view
 * shows the payload, and even then only to the endpoint owner).
 *
 * Tenant-scoped — a foreign endpoint returns 404 (no existence leakage).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const access = await canAccess(user.id, FEATURE_KEYS.WEBHOOK_ENDPOINTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Webhooks are not available on your current account." } },
      { status: 403 },
    );
  }

  const { id: idStr } = await params;
  const endpointId = Number(idStr);
  if (!Number.isInteger(endpointId) || endpointId <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid endpoint ID." } },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "page must be a positive integer." } },
      { status: 400 },
    );
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "pageSize must be a positive integer (max 100)." } },
      { status: 400 },
    );
  }

  // Tenant-scoped — findFirst with userId filter means foreign endpoints
  // return null and we 404 (no existence leakage).
  const ep = await db.webhookEndpoint.findFirst({
    where: { id: endpointId, userId: user.id },
    select: { id: true },
  });
  if (!ep) {
    return NextResponse.json(
      { error: { code: "endpoint_not_found", message: "Webhook endpoint not found." } },
      { status: 404 },
    );
  }

  const where = { endpointId: ep.id };
  const [total, deliveries] = await Promise.all([
    db.webhookDelivery.count({ where }),
    db.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    deliveries: deliveries.map((d) => ({
      delivery_id: d.deliveryId,
      event_id: d.eventId,
      request_id: d.requestId,
      status: d.status,
      response_code: d.responseCode,
      attempts: d.attempts,
      last_error: d.lastError, // safe classification only
      created_at: d.createdAt.toISOString(),
      delivered_at: d.deliveredAt?.toISOString() ?? null,
      // NEVER expose d.signature or d.payload here.
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
