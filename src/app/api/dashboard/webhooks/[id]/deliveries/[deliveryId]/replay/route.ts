import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { scheduleReplayDelivery } from "@/lib/dx/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/webhooks/:id/deliveries/:deliveryId/replay
 *
 * Schedule a manual replay of an existing delivery. The replay creates a NEW
 * auditable delivery record (with a fresh deliveryId, fresh signature using
 * the CURRENT endpoint secret, and a fresh timestamp). The original delivery
 * is NOT mutated.
 *
 * Tenant-scoped — a foreign delivery returns 404 (no existence leakage).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; deliveryId: string }> },
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

  const { id: idStr, deliveryId } = await params;
  const endpointId = Number(idStr);
  if (!Number.isInteger(endpointId) || endpointId <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid endpoint ID." } },
      { status: 400 },
    );
  }
  if (!deliveryId || deliveryId.length > 100) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid delivery ID." } },
      { status: 400 },
    );
  }

  try {
    // scheduleReplayDelivery verifies ownership through the endpoint's userId
    // (cross-tenant throws "endpoint_missing" — safe error, no leak).
    const result = await scheduleReplayDelivery(deliveryId, user.id);
    return NextResponse.json(
      { delivery_id: result.deliveryId },
      { status: 202 },
    );
  } catch (e: any) {
    if (e?.message === "endpoint_missing") {
      return NextResponse.json(
        { error: { code: "delivery_not_found", message: "Delivery not found." } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to schedule replay." } },
      { status: 500 },
    );
  }
}
