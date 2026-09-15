import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["pending", "delivered", "failed"]);
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

/**
 * GET /api/dashboard/webhooks/deliveries
 *
 * Paginated list of webhook deliveries across ALL of the authenticated
 * user's endpoints. Join: WebhookDelivery → WebhookEndpoint.userId = session.user.id.
 *
 * Filters: endpointId?, status?, page, pageSize.
 *
 * SAFE field selection — NEVER returns:
 *   - secret (HMAC signing secret)
 *   - signature (HMAC value)
 *   - payload (raw JSON body — may contain customer PII)
 * The `lastError` field is the safe classification only (network_error,
 * timeout, http_4xx, etc.) — never raw exception messages.
 *
 * Session-authenticated, tenant-scoped by User.id. Not API-key-authenticated.
 * Does NOT consume API_MESSAGES.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSizeRaw = Number(url.searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pageSizeRaw));
  const skip = (page - 1) * pageSize;

  const endpointIdRaw = url.searchParams.get("endpointId");
  const endpointId = endpointIdRaw ? Number(endpointIdRaw) : null;
  if (endpointIdRaw && (endpointId === null || !Number.isInteger(endpointId) || endpointId <= 0)) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "endpointId must be a positive integer." } },
      { status: 400 },
    );
  }

  const status = url.searchParams.get("status");
  if (status && !VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "status must be one of: pending, delivered, failed." } },
      { status: 400 },
    );
  }

  // Tenant scoping via the endpoint relation — never caller-supplied userId.
  const where: Prisma.WebhookDeliveryWhereInput = {
    endpoint: { userId: user.id },
  };
  if (endpointId) where.endpointId = endpointId;
  if (status) where.status = status;

  const [total, deliveries] = await Promise.all([
    db.webhookDelivery.count({ where }),
    db.webhookDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
      select: {
        deliveryId: true,
        endpointId: true,
        eventId: true,
        status: true,
        attempts: true,
        responseCode: true,
        createdAt: true,
        deliveredAt: true,
        lastError: true,
        // payload + signature intentionally NOT selected.
      },
    }),
  ]);

  return NextResponse.json({
    deliveries: deliveries.map((d) => ({
      deliveryId: d.deliveryId,
      endpointId: d.endpointId,
      eventId: d.eventId,
      status: d.status,
      attempts: d.attempts,
      responseCode: d.responseCode,
      createdAt: d.createdAt.toISOString(),
      deliveredAt: d.deliveredAt?.toISOString() ?? null,
      // Safe classification only — never raw exception text.
      lastError: d.lastError,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
