import { NextRequest } from "next/server";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { getAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/webhooks/deliveries?endpointId=<id>&page=1&pageSize=50
 *
 * Paginated list of webhook deliveries for a specific endpoint, newest first.
 * Powers the delivery history + replay/retry UI on the endpoint detail page.
 */
export async function GET(req: NextRequest) {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const url = new URL(req.url);
  const endpointIdRaw = url.searchParams.get("endpointId");
  const endpointId = Number(endpointIdRaw);
  if (!Number.isInteger(endpointId) || endpointId <= 0) {
    return apiError(
      ERROR_CODES.VALIDATION_FAILED,
      "Missing or invalid ?endpointId=",
      400,
    );
  }

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get("pageSize")) || 50));
  const skip = (page - 1) * pageSize;

  const [total, deliveries] = await Promise.all([
    db.webhookDelivery.count({ where: { endpointId } }),
    db.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    }),
  ]);

  return apiOk({
    endpointId,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    deliveries: deliveries.map((d) => ({
      id: d.id,
      eventId: d.eventId,
      requestId: d.requestId,
      status: d.status,
      responseCode: d.responseCode,
      attempts: d.attempts,
      lastError: d.lastError,
      createdAt: d.createdAt,
      deliveredAt: d.deliveredAt,
    })),
  });
}
