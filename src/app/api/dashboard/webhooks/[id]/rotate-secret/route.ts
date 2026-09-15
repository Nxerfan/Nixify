import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { generateWebhookSecret } from "@/lib/dx/webhooks";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/webhooks/:id/rotate-secret
 *
 * Generate a new signing secret for the endpoint, replacing the previous one.
 * The NEW secret is returned EXACTLY ONCE in this response.
 *
 * After rotation:
 *   - All in-flight deliveries already in the queue use the OLD secret (they
 *     were signed at scheduling time). They will continue to be attempted with
 *     the old signature — the recipient may reject them.
 *   - All FUTURE scheduled deliveries (including manual replays of existing
 *     deliveries) are re-signed with the NEW secret. See scheduleReplayDelivery
 *     in src/lib/dx/webhooks.ts — it re-signs with the current secret.
 *
 * Tenant-scoped: cross-tenant = 404 (no existence leakage).
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
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid endpoint ID." } },
      { status: 400 },
    );
  }

  // Tenant-scoped: cross-tenant = 404.
  const existing = await db.webhookEndpoint.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: { code: "webhook_not_found", message: "Webhook endpoint not found." } },
      { status: 404 },
    );
  }

  const newSecret = generateWebhookSecret();
  await db.webhookEndpoint.update({
    where: { id },
    data: { secret: newSecret },
  });

  return NextResponse.json({
    id,
    secret: newSecret, // shown ONCE — replaces all previous secrets
  });
}
