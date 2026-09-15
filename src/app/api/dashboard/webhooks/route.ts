import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { canAccess } from "@/lib/entitlements/engine";
import { FEATURE_KEYS, FEATURE_LIMITS } from "@/lib/entitlements/config";
import { generateWebhookSecret } from "@/lib/dx/webhooks";
import { validateWebhookDestination } from "@/lib/dx/ssrf";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  url: z.string().trim().min(1, "URL is required").max(2048, "URL is too long"),
  events: z
    .array(z.string().trim().min(1, "Event type cannot be empty").max(100, "Event type is too long"))
    .min(1, "At least one event subscription is required")
    .max(50, "Too many event subscriptions (max 50)"),
});

/**
 * Mask a webhook URL for the list view. Replaces the path/query with `/***`
 * so a quick glance at the dashboard cannot leak the full destination path.
 * The host is preserved so the user can still recognize the endpoint.
 *
 * Full URL is returned by GET /:id and POST (after create) — masking is
 * list-view-only.
 */
function maskUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (!u.pathname || u.pathname === "/") return u.origin;
    return `${u.origin}/***`;
  } catch {
    return "***";
  }
}

/**
 * GET /api/dashboard/webhooks
 *
 * List the authenticated user's webhook endpoints (active + inactive).
 * Session-authenticated, tenant-scoped by User.id. System endpoints
 * (userId=null) are NOT included — those are admin-managed.
 *
 * The signing `secret` is NEVER returned. URL is masked in this list view;
 * GET /:id returns the full URL.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  // page/pageSize are accepted for clients that want pagination, but the
  // endpoint list is naturally bounded by the plan quota (3 PRO, 25 MAX).
  // We honor the params when present so the dashboard UI can request a
  // smaller initial window and lazy-load more on demand.
  const url = new URL(req.url);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 100));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const skip = (page - 1) * pageSize;

  const [total, endpoints] = await Promise.all([
    db.webhookEndpoint.count({ where: { userId: user.id } }),
    db.webhookEndpoint.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
      include: {
        // Derive lastUsedAt from the most recent successful delivery.
        // Only deliveries with a non-null deliveredAt count.
        deliveries: {
          where: { deliveredAt: { not: null } },
          orderBy: { deliveredAt: "desc" },
          take: 1,
          select: { deliveredAt: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    endpoints: endpoints.map((ep) => ({
      id: ep.id,
      url: maskUrl(ep.url),
      events: ep.events,
      isActive: ep.isActive,
      createdAt: ep.createdAt.toISOString(),
      lastUsedAt: ep.deliveries[0]?.deliveredAt?.toISOString() ?? null,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

/**
 * POST /api/dashboard/webhooks
 *
 * Create a new webhook endpoint for the authenticated user.
 *
 * Validation:
 *   - URL validated via validateWebhookDestination() — SSRF-protected.
 *   - Events array: 1-50 non-empty strings.
 *   - Entitlement: WEBHOOK_ENDPOINTS access (PRO+ only) + capacity check
 *     (count active endpoints < plan quota).
 *
 * Capacity (NOT usage consumption):
 *   Endpoints are standing resources, not monthly-consumed units. We count
 *   ACTIVE endpoints against the plan's quota. Soft-deleting an endpoint
 *   frees the slot. (checkUsage() would never refund on delete — wrong
 *   semantics here.)
 *
 * The signing `secret` is generated server-side via generateWebhookSecret()
 * and returned EXACTLY ONCE in this response. It is never returned again —
 * rotate-secret returns a fresh one if lost.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "Login required." } },
      { status: 401 },
    );
  }

  // Access-gated: WEBHOOK_ENDPOINTS is PRO+ only.
  const access = await canAccess(user.id, FEATURE_KEYS.WEBHOOK_ENDPOINTS);
  if (!access.allowed) {
    return NextResponse.json(
      { error: { code: "feature_not_available", message: "Webhook endpoints are not available on your current account." } },
      { status: 403 },
    );
  }

  let body: z.infer<typeof createSchema>;
  try {
    const json = await req.json();
    const result = createSchema.safeParse(json);
    if (!result.success) {
      const msg = result.error.issues.map((i: any) => i.message).join("; ");
      return NextResponse.json(
        { error: { code: "validation_failed", message: msg } },
        { status: 400 },
      );
    }
    body = result.data;
  } catch {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  // SSRF validation at create time (section 18). Reject before persisting.
  const ssrf = await validateWebhookDestination(body.url);
  if (!ssrf.ok) {
    return NextResponse.json(
      { error: { code: ssrf.code, message: ssrf.message } },
      { status: 400 },
    );
  }

  // Capacity check: count ACTIVE endpoints owned by this user, compare to
  // plan quota. Soft-deleted (isActive=false) endpoints don't count.
  const limits = FEATURE_LIMITS[FEATURE_KEYS.WEBHOOK_ENDPOINTS][access.plan];
  if (limits && limits.quota !== Infinity) {
    const activeCount = await db.webhookEndpoint.count({
      where: { userId: user.id, isActive: true },
    });
    if (activeCount >= limits.quota) {
      return NextResponse.json(
        { error: { code: "quota_exhausted", message: `Webhook endpoint limit reached (${limits.quota} on ${access.plan}). Disable an existing endpoint or upgrade.` } },
        { status: 402 },
      );
    }
  }

  // Normalize events: dedupe + comma-join (storage format matches
  // endpointMatchesEvent() expectations in src/lib/dx/webhooks.ts).
  const eventsStr = Array.from(new Set(body.events)).join(",");
  const secret = generateWebhookSecret();

  const created = await db.webhookEndpoint.create({
    data: {
      userId: user.id,
      url: body.url,
      events: eventsStr,
      secret,
      isActive: true,
      createdBy: `user:${user.id}`,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      url: created.url,
      events: created.events,
      isActive: created.isActive,
      secret, // shown ONCE — never returned again by any route
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
