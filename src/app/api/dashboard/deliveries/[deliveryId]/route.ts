import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS } from "@/lib/entitlements/config";
import { getDelivery } from "@/lib/deliverability/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/deliveries/:deliveryId
 *
 * Fetch a single EmailDelivery row with its full event history.
 * Tenant-scoped — returns 404 if the delivery belongs to another user.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ deliveryId: string }> },
) {
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

  const { deliveryId } = await params;
  const delivery = await getDelivery(user.id, deliveryId);
  if (!delivery) {
    return NextResponse.json(
      { error: { code: "not_found", message: "Delivery not found." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ delivery });
}
