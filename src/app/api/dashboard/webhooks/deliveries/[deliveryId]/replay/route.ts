import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { scheduleReplayDelivery } from "@/lib/dx/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/webhooks/deliveries/:deliveryId/replay
 *
 * Schedule a manual replay of an existing delivery. Creates a NEW auditable
 * WebhookDelivery row with a FRESH signature (current endpoint secret + new
 * timestamp). Does NOT mutate the original delivery — both stay in history.
 *
 * The original delivery's endpoint MUST be owned by the caller. Cross-tenant
 * replays throw "endpoint_missing" inside scheduleReplayDelivery — we map
 * that to 404 to avoid existence leakage.
 *
 * Returns the NEW deliveryId (not the original).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deliveryId: string }> },
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const { deliveryId } = await params;
  if (!deliveryId || typeof deliveryId !== "string" || deliveryId.length > 100) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid deliveryId." } },
      { status: 400 },
    );
  }

  try {
    const result = await scheduleReplayDelivery(deliveryId, user.id);
    return NextResponse.json(
      { deliveryId: result.deliveryId },
      { status: 201 },
    );
  } catch (e) {
    // scheduleReplayDelivery throws "endpoint_missing" for:
    //   - delivery not found
    //   - delivery found but endpoint belongs to another tenant
    // Both cases return 404 — no existence leakage.
    if (e instanceof Error && e.message === "endpoint_missing") {
      return NextResponse.json(
        { error: { code: "delivery_not_found", message: "Webhook delivery not found." } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to schedule replay delivery." } },
      { status: 500 },
    );
  }
}
