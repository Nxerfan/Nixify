import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { scheduleTestDelivery } from "@/lib/dx/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/webhooks/:id/test
 *
 * Schedule a test delivery to this endpoint. The test event type is
 * "nixify.webhook.test" and bypasses subscription matching — every test
 * reaches the endpoint regardless of subscribed events.
 *
 * This only CREATES a WebhookDelivery(pending) + WebhookQueue(pending) row.
 * The actual HTTP delivery happens asynchronously via the queue processor
 * (POST /api/webhooks/process-queue). Returns immediately with the deliveryId.
 *
 * Tenant-scoped: scheduleTestDelivery verifies endpoint ownership via
 * { id, userId }. Cross-tenant throws "endpoint_missing" — we map that
 * to 404 to avoid existence leakage.
 */
export async function POST(
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

  const { id: idStr } = await params;
  const endpointId = Number(idStr);
  if (!Number.isInteger(endpointId) || endpointId <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid endpoint ID." } },
      { status: 400 },
    );
  }

  try {
    const { deliveryId } = await scheduleTestDelivery(endpointId, user.id);
    return NextResponse.json({ deliveryId }, { status: 201 });
  } catch (e) {
    // scheduleTestDelivery throws "endpoint_missing" for both not-found
    // and cross-tenant — same response (404) for both to avoid leakage.
    if (e instanceof Error && e.message === "endpoint_missing") {
      return NextResponse.json(
        { error: { code: "webhook_not_found", message: "Webhook endpoint not found." } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: { code: "internal_error", message: "Failed to schedule test delivery." } },
      { status: 500 },
    );
  }
}
