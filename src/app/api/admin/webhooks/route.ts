import { NextRequest } from "next/server";
import { z } from "zod";
import { apiOk, apiError, ERROR_CODES } from "@/lib/api-response";
import { parseBody } from "@/lib/http";
import { getAdmin } from "@/lib/auth/admin";
import { generateWebhookSecret } from "@/lib/dx/webhooks";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook endpoint management — admin-authenticated. The signing secret is
 * generated at creation and returned ONCE; we store it (the recipient needs it
 * to verify signatures, but we treat it as a secret so it's only displayed
 * once in the dashboard for copying to the user's webhook handler).
 */

/** GET /api/admin/webhooks — list all endpoints + 20 most-recent deliveries. */
export async function GET() {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const endpoints = await db.webhookEndpoint.findMany({
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
      url: e.url,
      events: e.events,
      isActive: e.isActive,
      createdAt: e.createdAt,
      createdBy: e.createdBy,
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
  const admin = await getAdmin();
  if (!admin) return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);

  const [data, err] = await parseBody(req, createSchema);
  if (err) return err;

  // Entitlement: webhook endpoints are PRO+ only + volume quota.
  const { canAccess, checkUsage } = await import("@/lib/entitlements/engine");
  const { FEATURE_KEYS: FK } = await import("@/lib/entitlements/config");
  const access = await canAccess(Number(admin.sub), FK.WEBHOOK_ENDPOINTS);
  if (!access.allowed) {
    return apiError(ERROR_CODES.FORBIDDEN, "Webhooks are not available on your plan.", 403);
  }
  const usage = await checkUsage(Number(admin.sub), FK.WEBHOOK_ENDPOINTS);
  if (!usage.allowed) {
    return apiError(
      ERROR_CODES.FORBIDDEN,
      usage.reason === "rate_limited" ? "Too many requests. Please wait." : "Webhook endpoint limit reached. Upgrade for more.",
      usage.reason === "rate_limited" ? 429 : 402,
    );
  }

  const secret = generateWebhookSecret();
  const created = await db.webhookEndpoint.create({
    data: {
      url: data.url,
      events: Array.from(new Set(data.events)).join(","),
      secret,
      isActive: true,
      createdBy: admin.email,
    },
  });

  return apiOk(
    {
      id: created.id,
      url: created.url,
      events: created.events,
      isActive: created.isActive,
      secret, // shown ONCE
      createdAt: created.createdAt,
    },
    201,
  );
}

/** DELETE /api/admin/webhooks?id=123 — delete an endpoint + its delivery history. */
export async function DELETE(req: NextRequest) {
  if (!(await getAdmin())) {
    return apiError(ERROR_CODES.UNAUTHORIZED, "Admin login required.", 401);
  }
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return apiError(ERROR_CODES.VALIDATION_FAILED, "Missing or invalid ?id=", 400);
  }
  // Confirm existence first so we return a clean 404 (vs. a constraint error).
  const existing = await db.webhookEndpoint.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return apiError(ERROR_CODES.NOT_FOUND, "Webhook endpoint not found.", 404);
  }
  // Manually cascade: delete delivery records first (the schema relation is
  // `Restrict` by default on SQLite, so we must clear children before parent).
  await db.webhookDelivery.deleteMany({ where: { endpointId: id } });
  await db.webhookEndpoint.delete({ where: { id } });
  return apiOk({ message: `Webhook endpoint ${id} deleted.` });
}
