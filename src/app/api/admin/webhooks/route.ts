import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { resolveThemesViewer } from "@/lib/themes-auth";
import { generateWebhookSecret } from "@/lib/dx/webhooks";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook endpoint management — accessible to any authenticated user (admin OR
 * user). Endpoints are scoped by `userId` so a user only sees/manages their own
 * endpoints (+ system endpoints with `userId=null`).
 *
 * The signing secret is generated at creation and returned ONCE; we store it
 * (the recipient needs it to verify signatures, but we treat it as a secret so
 * it's only displayed once in the dashboard for copying to the user's webhook
 * handler).
 */

/** GET /api/admin/webhooks — list endpoints visible to the caller + 20 most-recent deliveries. */
export async function GET() {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  // Admin sees all endpoints; user sees only their own + system endpoints.
  const where = auth.mode === "admin"
    ? undefined
    : { OR: [{ userId: auth.userId }, { userId: null }] };
  const endpoints = await db.webhookEndpoint.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  return apiOk({
    endpoints: endpoints.map((e) => ({
      id: e.id,
      userId: e.userId,
      url: e.url,
      events: e.events,
      isActive: e.isActive,
      createdAt: e.createdAt,
      createdBy: e.createdBy,
      // canModify = admin OR endpoint is owned by the caller (not a system endpoint).
      canModify: auth.mode === "admin" || e.userId === auth.userId,
      recentDeliveries: e.deliveries.map((d) => ({
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
    })),
  });
}

const createSchema = z.object({
  url: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .refine(
      (u) => u.startsWith("http://") || u.startsWith("https://"),
      "URL must be http(s)://",
    ),
  events: z
    .array(z.string().min(1))
    .min(1, "At least one event is required")
    .max(50),
});

/** POST /api/admin/webhooks — register a new endpoint. Returns the secret ONCE. */
export async function POST(req: NextRequest) {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const [data, err] = await parseBody(req, createSchema);
  if (err) return err;

  // Entitlement: resource cardinality check (NOT consumable usage).
  // WEBHOOK_ENDPOINTS is a resource-count limit, not a monthly quota.
  // Access check (PRO+ only) is integrated into createResourceWithCapacity.
  // Uses a concurrency-safe transaction with a row lock.
  const { createResourceWithCapacity } = await import("@/lib/entitlements/resource-capacity");
  const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");

  const secret = generateWebhookSecret();
  let created;
  try {
    created = await createResourceWithCapacity(
      auth.userId,
      FK.WEBHOOK_ENDPOINTS,
      async (tx) => {
        return tx.webhookEndpoint.create({
          data: {
            userId: auth.userId,
            url: data.url,
            events: Array.from(new Set(data.events)).join(","),
            secret,
            isActive: true,
            createdBy: auth.mode === "admin" ? `admin:${auth.userId}` : `user:${auth.userId}`,
          },
        });
      },
    );
  } catch (e: any) {
    if (e?.reason === "not_available_on_plan" || e?.message?.includes("not available on your plan")) {
      return apiError(ERROR_CODES.FORBIDDEN, "Webhooks are not available on your plan.", 403);
    }
    if (e?.reason === "quota_exhausted" || e?.message?.includes("Resource limit reached")) {
      return apiError(ERROR_CODES.FORBIDDEN, "Webhook endpoint limit reached. Upgrade for more.", 402);
    }
    throw e;
  }

  return apiOk(
    {
      id: created.id,
      userId: created.userId,
      url: created.url,
      events: created.events,
      isActive: created.isActive,
      secret, // shown ONCE
      createdAt: created.createdAt,
    },
    201,
  );
}

/** DELETE /api/admin/webhooks?id=123 — delete an endpoint + its delivery history.
 *  Ownership: admin can delete any; user can delete only their own (NOT system). */
export async function DELETE(req: NextRequest) {
  const auth = await resolveThemesViewer();
  if (!auth.ok) return apiError(auth.code, auth.message, auth.status);

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing or invalid ?id=", 400);
  }
  // Fetch the endpoint so we can enforce ownership.
  const existing = await db.webhookEndpoint.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!existing) {
    return apiError(ERROR_CODES.NOT_FOUND, "Webhook endpoint not found.", 404);
  }
  // Ownership check: admin can modify anything; user can modify only their own
  // (system endpoints with userId=null are admin-only).
  if (!auth.canModify(existing.userId)) {
    return apiError(ERROR_CODES.FORBIDDEN, "You do not own this webhook endpoint.", 403);
  }
  // Manually cascade: delete delivery records first (the schema relation is
  // `Restrict` by default on SQLite, so we must clear children before parent).
  await db.webhookDelivery.deleteMany({ where: { endpointId: id } });
  await db.webhookEndpoint.delete({ where: { id } });
  return apiOk({ message: `Webhook endpoint ${id} deleted.` });
}
