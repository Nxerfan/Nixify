import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set(["pending", "delivered", "failed"]);
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

/** Parse ?from + ?to ISO date strings into a Prisma DateTime filter. */
function parseDateRange(
  from: string | null,
  to: string | null,
): { ok: true; range: { gte?: Date; lte?: Date } } | { ok: false } {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (isNaN(d.getTime())) return { ok: false };
    range.gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (isNaN(d.getTime())) return { ok: false };
    range.lte = d;
  }
  return { ok: true, range };
}

/**
 * GET /api/dashboard/logs/webhooks
 *
 * Paginated list of WebhookDelivery rows, scoped through endpoint ownership.
 * Join: WebhookDelivery → WebhookEndpoint.userId = session.user.id.
 *
 * Filters: endpointId?, status?, eventId?, dateRange?.
 *
 * SAFE field selection — NEVER returns:
 *   - secret (HMAC signing secret — stored on the endpoint, never selected)
 *   - signature (HMAC value on the delivery row, never selected)
 *   - payload (raw JSON body sent to the endpoint, never selected)
 *
 * The `lastError` field is the safe classification only (network_error,
 * timeout, http_4xx, http_5xx, ssrf_blocked, endpoint_missing,
 * configuration_error, max_attempts_exceeded) — never raw exceptions.
 *
 * Session-authenticated, tenant-scoped by User.id. Does NOT consume API_MESSAGES.
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

  // eventId filter: WebhookDelivery.eventId is the webhook envelope type
  // (e.g. "nixify.event.received", "otp.sent", "nixify.webhook.test") — NOT
  // the public delivery UUID. Exact match.
  const eventId = url.searchParams.get("eventId")?.trim() || undefined;

  const dateRange = parseDateRange(
    url.searchParams.get("from"),
    url.searchParams.get("to"),
  );
  if (!dateRange.ok) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid date range. Use ISO 8601 for ?from and ?to." } },
      { status: 400 },
    );
  }

  // Tenant scoping via the endpoint relation — never caller-supplied userId.
  const where: Prisma.WebhookDeliveryWhereInput = {
    endpoint: { userId: user.id },
  };
  if (endpointId) where.endpointId = endpointId;
  if (status) where.status = status;
  if (eventId) where.eventId = eventId;
  if (dateRange.range.gte || dateRange.range.lte) {
    where.createdAt = {};
    if (dateRange.range.gte) where.createdAt.gte = dateRange.range.gte;
    if (dateRange.range.lte) where.createdAt.lte = dateRange.range.lte;
  }

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
